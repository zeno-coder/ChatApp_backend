require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.get("/", (req, res) => res.redirect("/signup.html"));
app.use(express.static(path.join(__dirname, "public")));
// Ping route
app.get("/ping", (req, res) => {
  res.send("Server is alive ✅");
});
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
   ssl: { rejectUnauthorized: false }  // ✅ required for Render
});

// DB init
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rooms (
      room_id SERIAL PRIMARY KEY,
      user_1_id INT REFERENCES users(user_id),
      user_2_id INT REFERENCES users(user_id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      message_id SERIAL PRIMARY KEY,
      room_id INT REFERENCES rooms(room_id) ON DELETE CASCADE,
      sender_id INT REFERENCES users(user_id),
      message_content TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ Tables ready");
}
initDB();

// Signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");
  const hash = await bcrypt.hash(password, 10);
  try {
    const insert = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
      [username, hash]
    );
    const user = insert.rows[0];

    // Assign to 2-user room
    let room = await pool.query(
      "SELECT * FROM rooms WHERE user_2_id IS NULL AND user_1_id <> $1 ORDER BY created_at ASC LIMIT 1",
      [user.user_id]
    );
    if (room.rows.length > 0) {
      await pool.query(
        "UPDATE rooms SET user_2_id=$1 WHERE room_id=$2",
        [user.user_id, room.rows[0].room_id]
      );
    } else {
      await pool.query("INSERT INTO rooms (user_1_id) VALUES ($1)", [user.user_id]);
    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET);
    res.status(201).json({ token, user_id: user.user_id, username: user.username });
  } catch (err) {
    if (err.code === '23505') return res.status(409).send("Username taken");
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");
  try {
    const result = await pool.query("SELECT * FROM users WHERE LOWER(username)=LOWER($1)", [username]);
    if (!result.rows[0]) return res.status(401).send("User not found");
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).send("Wrong password");

    const user = result.rows[0];

    // Assign room if not yet assigned
    let room = await pool.query("SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1", [user.user_id]);
    if (room.rows.length === 0) {
      let available = await pool.query(
        "SELECT * FROM rooms WHERE user_2_id IS NULL AND user_1_id <> $1 ORDER BY created_at ASC LIMIT 1",
        [user.user_id]
      );
      if (available.rows.length > 0) {
        await pool.query("UPDATE rooms SET user_2_id=$1 WHERE room_id=$2", [user.user_id, available.rows[0].room_id]);
      } else {
        await pool.query("INSERT INTO rooms (user_1_id) VALUES ($1)", [user.user_id]);
      }
    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET);
    res.json({ token, user_id: user.user_id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Socket auth
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user_id = payload.user_id;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// Track multiple sockets per user
const userSockets = new Map(); // user_id => Set(socket.id)
const roomSockets = new Map(); // room_id => Set(user_id)

io.on("connection", async (socket) => {
  const userId = socket.user_id;
  console.log("User connected:", userId);

  // Track all sockets for this user
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);

  // Find user's permanent room
  let roomRes = await pool.query("SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1", [userId]);
  if (roomRes.rows.length === 0) {
    console.error("No room assigned for user", userId);
    return;
  }
  const roomId = roomRes.rows[0].room_id;

  // Join all sockets of this user to the room
  userSockets.get(userId).forEach(sid => {
    io.sockets.sockets.get(sid)?.join(`room_${roomId}`);
  });

  // Track active users in room
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(userId);

  // Load previous messages
  const messages = await pool.query(
    "SELECT * FROM messages WHERE room_id=$1 ORDER BY timestamp ASC",
    [roomId]
  );
  socket.emit("joined_room", { room_id: roomId, messages: messages.rows });

  // Broadcast active users
  // --- add this helper at the top of io.on("connection") ---
async function broadcastActiveUsers(roomId) {
  const userIds = Array.from(roomSockets.get(roomId) || []);
  if (userIds.length === 0) return;

  const res = await pool.query(
    "SELECT username FROM users WHERE user_id = ANY($1::int[])",
    [userIds]
  );

  const activeUsers = res.rows.map(r => r.username);
  io.to(`room_${roomId}`).emit("update users", activeUsers);
}

// --- inside connection, after user joins room ---
await broadcastActiveUsers(roomId);

// --- inside disconnect, after removing user from roomSockets ---
await broadcastActiveUsers(roomId);


  // Chat message
  socket.on("chat message", async (msg) => {
    const insert = await pool.query(
      "INSERT INTO messages (room_id, sender_id, message_content) VALUES ($1,$2,$3) RETURNING *",
      [roomId, userId, msg.text]
    );
    io.to(`room_${roomId}`).emit("chat message", {
      user: msg.user,
      text: msg.text,
      id: insert.rows[0].message_id,
      ts: insert.rows[0].timestamp
    });
  });

  // Voice messages
  socket.on("voice message", async (msg) => {
    const insert = await pool.query(
      "INSERT INTO messages (room_id, sender_id, message_content) VALUES ($1,$2,$3) RETURNING *",
      [roomId, userId, "[voice]"]
    );
    io.to(`room_${roomId}`).emit("voice message", { ...msg, id: insert.rows[0].message_id });
  });

  // Fetch username once when connection starts
const userRes = await pool.query("SELECT username FROM users WHERE user_id=$1", [socket.user_id]);
const username = userRes.rows[0].username;

// Typing indicators (only notify other users)
socket.on("typing", () => {
  socket.to(`room_${roomId}`).emit("typing", username);
});
socket.on("stop typing", () => {
  socket.to(`room_${roomId}`).emit("stop typing", username);
});

// Recording indicators (only notify other users)
socket.on("start recording", () => {
  socket.to(`room_${roomId}`).emit("start recording", username);
});
socket.on("stop recording", () => {
  socket.to(`room_${roomId}`).emit("stop recording", username);
});

  // Delete message
  socket.on("delete message", async (data) => {
    await pool.query("DELETE FROM messages WHERE message_id=$1", [data.targetId]);
    io.to(`room_${roomId}`).emit("delete message", data);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", userId);
    const socketsSet = userSockets.get(userId);
    if (socketsSet) {
      socketsSet.delete(socket.id);
      if (socketsSet.size === 0) {
        userSockets.delete(userId);
        roomSockets.get(roomId)?.delete(userId);
        io.to(`room_${roomId}`).emit("update users", Array.from(roomSockets.get(roomId) || []));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
