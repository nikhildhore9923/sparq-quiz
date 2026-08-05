const Database = require("better-sqlite3");
const db = new Database("./quiz.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    host_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting | active | finished
    current_question_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL, -- 'A' | 'B' | 'C' | 'D'
    time_limit_seconds INTEGER NOT NULL DEFAULT 20,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    connected INTEGER DEFAULT 1,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    selected_option TEXT,
    is_correct INTEGER NOT NULL,
    response_time_ms INTEGER,
    points_awarded INTEGER DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (participant_id) REFERENCES participants(id)
  );
`);

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 - easy to misread on a phone
  let code;
  let exists = true;
  while (exists) {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    exists = db.prepare("SELECT id FROM rooms WHERE code = ?").get(code);
  }
  return code;
}

function generateToken() {
  return (
    Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
}

module.exports = { db, generateRoomCode, generateToken };
