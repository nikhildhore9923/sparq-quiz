const Database = require("better-sqlite3");
const path = require("path");

// Put the db in the root of the backend folder
const dbPath = path.join(__dirname, "../../quiz.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    host_name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'Classic', -- Classic | Rapid Fire | Survival
    status TEXT NOT NULL DEFAULT 'WAITING', -- WAITING | STARTING | QUESTION_ACTIVE | QUESTION_ENDED | FINISHED
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
    streak INTEGER DEFAULT 0,
    connected INTEGER DEFAULT 1,
    eliminated INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS saved_quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL,
    time_limit_seconds INTEGER NOT NULL DEFAULT 20,
    FOREIGN KEY (quiz_id) REFERENCES saved_quizzes(id)
  );
`);

// Graceful migrations for existing deployed databases
try {
  db.prepare("ALTER TABLE participants ADD COLUMN streak INTEGER DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE rooms ADD COLUMN mode TEXT DEFAULT 'Classic'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE participants ADD COLUMN eliminated INTEGER DEFAULT 0").run();
} catch (e) {}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
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
