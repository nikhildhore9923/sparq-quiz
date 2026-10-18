const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

// Put the db in the root of the backend folder or custom persistent disk path
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "../../quiz.db");
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
    host_token TEXT,
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
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Graceful migrations for existing databases
try {
  db.prepare("ALTER TABLE participants ADD COLUMN streak INTEGER DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE rooms ADD COLUMN mode TEXT DEFAULT 'Classic'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE participants ADD COLUMN eliminated INTEGER DEFAULT 0").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE saved_quizzes ADD COLUMN user_id INTEGER").run();
} catch (e) {}
/**
 * Migration: Ensures rooms table has host_token and backfills NULL values.
 * - Safely handles the expected 'column already exists' case
 * - Never silently swallows unexpected errors during schema check or backfill
 * - Atomically backfills unique cryptographic tokens for any legacy rows with NULL host_token
 * - Preserves existing valid host tokens and quiz data
 */
function migrateHostToken(database = db) {
  // 1. Verify or add host_token column
  try {
    const columns = database.prepare("PRAGMA table_info(rooms)").all();
    const hasHostToken = columns.some((col) => col.name === "host_token");

    if (!hasHostToken) {
      try {
        database.prepare("ALTER TABLE rooms ADD COLUMN host_token TEXT").run();
      } catch (alterErr) {
        const isDuplicate = alterErr.message && alterErr.message.toLowerCase().includes("duplicate column name");
        if (!isDuplicate) {
          console.error("Critical database migration failure: Could not add 'host_token' column:", alterErr.message);
          throw alterErr;
        }
      }
    }
  } catch (schemaErr) {
    if (!schemaErr.message || !schemaErr.message.toLowerCase().includes("duplicate column name")) {
      console.error("Critical database migration failure: Schema check failed for 'rooms' table:", schemaErr.message);
      throw schemaErr;
    }
  }

  // 2. Backfill legacy rooms that have a NULL host_token so authorization cannot be bypassed
  try {
    const legacyRooms = database.prepare("SELECT id FROM rooms WHERE host_token IS NULL").all();
    if (legacyRooms.length > 0) {
      const updateToken = database.prepare("UPDATE rooms SET host_token = ? WHERE id = ?");
      const backfillTx = database.transaction((rooms) => {
        for (const r of rooms) {
          updateToken.run(crypto.randomBytes(24).toString("hex"), r.id);
        }
      });
      backfillTx(legacyRooms);
    }
  } catch (backfillErr) {
    console.error("Critical database migration failure: Could not backfill NULL host_tokens in 'rooms':", backfillErr.message);
    throw backfillErr;
  }
}

// Execute migration for the active database on startup
try {
  migrateHostToken(db);
} catch (err) {
  console.error("FATAL: Database initialization halted due to host_token migration failure. Preventing startup in insecure state.");
  process.exit(1);
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No easily confused characters like O/0/I/1
  let code;
  let exists = true;
  while (exists) {
    code = Array.from({ length: 6 }, () => chars[crypto.randomInt(0, chars.length)]).join("");
    exists = db.prepare("SELECT id FROM rooms WHERE code = ?").get(code);
  }
  return code;
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

module.exports = { db, generateRoomCode, generateToken, migrateHostToken };
