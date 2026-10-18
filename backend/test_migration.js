const Database = require("better-sqlite3");
const { migrateHostToken } = require("./src/db/database");

let passed = 0;
let failed = 0;

function check(label, cond) {
  if (cond) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label}`);
    failed++;
  }
}

function runMigrationTests() {
  console.log("==================================================");
  console.log("      Sparq SQLite host_token Migration Tests     ");
  console.log("==================================================");

  // -------------------------------------------------------------------------
  // Test 1: Fresh Database (Column already defined in CREATE TABLE)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 1: Fresh Database Migration ---");
  const freshDb = new Database(":memory:");
  freshDb.exec(`
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      host_name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'Classic',
      status TEXT NOT NULL DEFAULT 'WAITING',
      current_question_index INTEGER DEFAULT 0,
      host_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  let freshError = null;
  try {
    migrateHostToken(freshDb);
  } catch (err) {
    freshError = err;
  }
  check("Fresh DB: Migration executed without error", freshError === null);

  const freshColumns = freshDb.prepare("PRAGMA table_info(rooms)").all();
  const freshHasToken = freshColumns.some((c) => c.name === "host_token");
  check("Fresh DB: host_token column exists in schema", freshHasToken);

  // -------------------------------------------------------------------------
  // Test 2: Existing Database where host_token column already exists with data
  // -------------------------------------------------------------------------
  console.log("\n--- Test 2: Existing Database with Column & Valid Tokens ---");
  const existingDb = new Database(":memory:");
  existingDb.exec(`
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      host_name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'Classic',
      status TEXT NOT NULL DEFAULT 'WAITING',
      current_question_index INTEGER DEFAULT 0,
      host_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const initialTokenA = "valid_host_token_aaaa_1111_2222_3333";
  const initialTokenB = "valid_host_token_bbbb_4444_5555_6666";
  existingDb.prepare("INSERT INTO rooms (code, host_name, host_token) VALUES (?, ?, ?)").run("ROOM_A", "Alice", initialTokenA);
  existingDb.prepare("INSERT INTO rooms (code, host_name, host_token) VALUES (?, ?, ?)").run("ROOM_B", "Bob", initialTokenB);

  let existingError = null;
  try {
    migrateHostToken(existingDb);
  } catch (err) {
    existingError = err;
  }
  check("Existing DB: Re-running migration produces no error", existingError === null);

  const roomA = existingDb.prepare("SELECT * FROM rooms WHERE code = 'ROOM_A'").get();
  const roomB = existingDb.prepare("SELECT * FROM rooms WHERE code = 'ROOM_B'").get();
  check("Existing DB: Token A preserved verbatim without modification", roomA.host_token === initialTokenA);
  check("Existing DB: Token B preserved verbatim without modification", roomB.host_token === initialTokenB);
  check("Existing DB: Host names and room metadata preserved", roomA.host_name === "Alice" && roomB.host_name === "Bob");

  // -------------------------------------------------------------------------
  // Test 3: Legacy Database without host_token column & NULL tokens
  // -------------------------------------------------------------------------
  console.log("\n--- Test 3: Legacy Database Migration & Backfill ---");
  const legacyDb = new Database(":memory:");
  // Simulate legacy schema prior to host_token introduction
  legacyDb.exec(`
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      host_name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'Classic',
      status TEXT NOT NULL DEFAULT 'WAITING',
      current_question_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  legacyDb.prepare("INSERT INTO rooms (code, host_name) VALUES (?, ?)").run("LEG_1", "LegacyHost1");
  legacyDb.prepare("INSERT INTO rooms (code, host_name) VALUES (?, ?)").run("LEG_2", "LegacyHost2");
  legacyDb.prepare("INSERT INTO rooms (code, host_name) VALUES (?, ?)").run("LEG_3", "LegacyHost3");

  const legacyColumnsBefore = legacyDb.prepare("PRAGMA table_info(rooms)").all();
  check("Legacy DB: host_token column does NOT exist before migration", !legacyColumnsBefore.some((c) => c.name === "host_token"));

  let legacyError = null;
  try {
    migrateHostToken(legacyDb);
  } catch (err) {
    legacyError = err;
  }
  check("Legacy DB: Migration executed without error", legacyError === null);

  const legacyColumnsAfter = legacyDb.prepare("PRAGMA table_info(rooms)").all();
  check("Legacy DB: host_token column exists after migration", legacyColumnsAfter.some((c) => c.name === "host_token"));

  const migratedRooms = legacyDb.prepare("SELECT * FROM rooms ORDER BY id ASC").all();
  check("Legacy DB: All 3 legacy rooms retrieved", migratedRooms.length === 3);

  const allTokensValid = migratedRooms.every(
    (r) => typeof r.host_token === "string" && r.host_token.length === 48 && /^[0-9a-f]{48}$/.test(r.host_token)
  );
  check("Legacy DB: All NULL tokens backfilled with 48-char cryptographic hex tokens", allTokensValid);

  const uniqueTokens = new Set(migratedRooms.map((r) => r.host_token));
  check("Legacy DB: Each backfilled room has a unique, non-colliding token", uniqueTokens.size === 3);
  check("Legacy DB: Existing room data (code, host_name) preserved intact", migratedRooms[0].code === "LEG_1" && migratedRooms[0].host_name === "LegacyHost1");

  // -------------------------------------------------------------------------
  // Test 4: Mixed Database (Some rooms with tokens, some with NULL tokens)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 4: Mixed Database Migration ---");
  const mixedDb = new Database(":memory:");
  mixedDb.exec(`
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      host_name TEXT NOT NULL,
      host_token TEXT
    );
  `);

  const preservedToken = "already_set_secure_token_999999999999";
  mixedDb.prepare("INSERT INTO rooms (code, host_name, host_token) VALUES (?, ?, ?)").run("MIX_1", "HostWithToken", preservedToken);
  mixedDb.prepare("INSERT INTO rooms (code, host_name, host_token) VALUES (?, ?, ?)").run("MIX_2", "HostWithoutToken", null);

  migrateHostToken(mixedDb);

  const mix1 = mixedDb.prepare("SELECT * FROM rooms WHERE code = 'MIX_1'").get();
  const mix2 = mixedDb.prepare("SELECT * FROM rooms WHERE code = 'MIX_2'").get();
  check("Mixed DB: Room with existing token remained completely untouched", mix1.host_token === preservedToken);
  check("Mixed DB: Room with NULL token was successfully backfilled", typeof mix2.host_token === "string" && mix2.host_token.length === 48);

  // -------------------------------------------------------------------------
  // Test 5: Error Handling: Unexpected Database Errors Are NOT Silently Swallowed
  // -------------------------------------------------------------------------
  console.log("\n--- Test 5: Unexpected Error Handling ---");
  const brokenDb = new Database(":memory:");
  // Database without rooms table at all
  let unexpectedThrown = false;
  // Temporarily suppress console.error during expected failure test
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    migrateHostToken(brokenDb);
  } catch (err) {
    unexpectedThrown = true;
  } finally {
    console.error = originalConsoleError;
  }
  check("Error Handling: Unexpected database error is thrown and NOT silently swallowed", unexpectedThrown);

  // Clean up
  freshDb.close();
  existingDb.close();
  legacyDb.close();
  mixedDb.close();
  brokenDb.close();

  console.log("==================================================");
  console.log(`Migration Test Summary: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  return { passed, failed };
}

if (require.main === module) {
  const { failed } = runMigrationTests();
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { runMigrationTests };
