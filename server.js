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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // required for Render
});
// Helper to generate unique 4-digit room codes
async function generateRoomCode() {
  let code;
  let exists = true;
  while (exists) {
    code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    const res = await pool.query("SELECT * FROM rooms WHERE room_code=$1", [code]);
    if (res.rows.length === 0) exists = false;
  }
  return code;
}


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
      room_code VARCHAR(4) UNIQUE,
      locked BOOLEAN DEFAULT FALSE,
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
initDB().catch(err => {
  console.error("❌ DB init failed:", err);
});

// Signup (normal or with room code)
app.post("/signup", async (req, res) => {
  const { username, password, room_code } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");
  const hash = await bcrypt.hash(password, 10);

  try {
    const insert = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
      [username, hash]
    );
    const user = insert.rows[0];

    let roomId;

    if (room_code) {
  const roomRes = await pool.query(
    "SELECT * FROM rooms WHERE room_code=$1 AND user_2_id IS NULL",
    [room_code]
  );

  if (roomRes.rows.length === 0) {
    return res.status(404).send("Invalid or full room code");
  }

  // ✅ assign to outer roomId
  roomId = roomRes.rows[0].room_id;

  await pool.query(
    "UPDATE rooms SET user_2_id=$1, locked=true WHERE room_id=$2",
    [user.user_id, roomId]
  );
}
 else {
      // Normal signup → create new room with user_1_id
const code = await generateRoomCode();
const newRoom = await pool.query(
  "INSERT INTO rooms (user_1_id, room_code) VALUES ($1, $2) RETURNING *",
  [user.user_id, code]
);
roomId = newRoom.rows[0].room_id;

    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET);
    res.status(201).json({ token, user_id: user.user_id, username: user.username, room_id: roomId });
  } catch (err) {
    if (err.code === '23505') return res.status(409).send("Username taken");
    console.error(err);
    res.status(500).send("Server error");
  }
});
// Generate room code for user_1 (3-dot menu)
app.post("/generate-room-code", async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    // Only user_1 can generate / see room code
    const roomRes = await pool.query(
      "SELECT * FROM rooms WHERE user_1_id = $1",
      [user_id]
    );

    if (roomRes.rows.length === 0) {
      return res.status(403).json({ error: "Not room owner" });
    }

    const room = roomRes.rows[0];

    // If room already full, don't regenerate
    if (room.user_2_id) {
      return res.json({ room_code: null });
    }

    // If already has a code, reuse it
    if (room.room_code) {
      return res.json({ room_code: room.room_code });
    }

    // Generate new code
    const code = await generateRoomCode();

    await pool.query(
      "UPDATE rooms SET room_code=$1 WHERE room_id=$2",
      [code, room.room_id]
    );

    res.json({ room_code: code });
  } catch (err) {
    console.error("Generate room code failed:", err);
    res.status(500).json({ error: "Server error" });
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

    // Fetch the user's room (permanent)
    let roomRes = await pool.query("SELECT * FROM rooms WHERE user_1_id=$1 OR user_2_id=$1", [user.user_id]);
    let roomId = null;

    if (roomRes.rows.length > 0) {
      roomId = roomRes.rows[0].room_id;

      // If user is second in the room and DB has empty user_2_id, update it
      const room = roomRes.rows[0];
      if (room.user_1_id !== user.user_id && !room.user_2_id) {
        await pool.query(
          "UPDATE rooms SET user_2_id=$1, locked=true WHERE room_id=$2",
          [user.user_id, roomId]
        );
      }
    }

    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET);
    res.json({ token, user_id: user.user_id, username: user.username, room_id: roomId });
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
async function broadcastActiveUsers(io, pool, roomSockets, roomId) {
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
await broadcastActiveUsers(io, pool, roomSockets, roomId);

// --- inside disconnect, after removing user from roomSockets ---
await broadcastActiveUsers(io, pool, roomSockets, roomId);



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
// ---------------------------
// Room Code logic
// ---------------------------
socket.on("check room", async (_, callback) => {
  try {
    const roomRes = await pool.query(
      "SELECT room_code, room_id FROM rooms WHERE user_1_id=$1 OR user_2_id=$1",
      [socket.user_id]
    );

    if (roomRes.rows.length === 0) return callback({ filled: true, code: null });

    const room = roomRes.rows[0];

    // ✅ Use live occupancy from roomSockets instead of DB user_2_id
    const liveUsers = roomSockets.get(room.room_id) || new Set();
    const filled = liveUsers.size >= 2; // room is full if 2 users connected

    callback({ filled, code: room.room_code });
  } catch (err) {
    console.error("Room code check failed:", err);
    callback({ filled: true, code: null });
  }
});


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
socket.on("disconnect", async () => {
  console.log("User disconnected:", userId);

  const socketsSet = userSockets.get(userId);
  if (socketsSet) {
    socketsSet.delete(socket.id);

    if (socketsSet.size === 0) {
      userSockets.delete(userId);
      roomSockets.get(roomId)?.delete(userId);

      await broadcastActiveUsers(io, pool, roomSockets, roomId);
    }
  }
});
});
// Ping route
app.get("/ping", (req, res) => {
  res.send("Server is alive ✅");
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
