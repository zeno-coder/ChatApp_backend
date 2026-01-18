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
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
// Serve static files
app.use(express.static(path.join(__dirname, "public")));


// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

// Auto-create tables
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
    const token = jwt.sign({ user_id: user.user_id }, process.env.JWT_SECRET);
    res.json({ token, user_id: user.user_id, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

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

io.on("connection", (socket) => {
  console.log("User connected:", socket.user_id);

  // join a room with another user
  socket.on("join_room", async ({ other_user_id }) => {
    try {
      // check if permanent room exists
      let roomResult = await pool.query(
        "SELECT * FROM rooms WHERE (user_1_id=$1 AND user_2_id=$2) OR (user_1_id=$2 AND user_2_id=$1)",
        [socket.user_id, other_user_id]
      );

      let room;
      if (roomResult.rows.length > 0) {
        room = roomResult.rows[0];
      } else {
        let insert = await pool.query(
          "INSERT INTO rooms (user_1_id, user_2_id) VALUES ($1,$2) RETURNING *",
          [socket.user_id, other_user_id]
        );
        room = insert.rows[0];
      }

      socket.join(`room_${room.room_id}`);

      // load previous messages
      const messages = await pool.query(
        "SELECT * FROM messages WHERE room_id=$1 ORDER BY timestamp ASC",
        [room.room_id]
      );

      socket.emit("joined_room", { room_id: room.room_id, messages: messages.rows });
    } catch (err) {
      console.error(err);
    }
  });

  // send message
  socket.on("send_message", async ({ room_id, message }) => {
    try {
      const insert = await pool.query(
        "INSERT INTO messages (room_id, sender_id, message_content) VALUES ($1, $2, $3) RETURNING *",
        [room_id, socket.user_id, message]
      );
      io.to(`room_${room_id}`).emit("receive_message", insert.rows[0]);
    } catch (err) { console.error(err); }
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
