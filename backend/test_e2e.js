const { io } = require("socket.io-client");
const { db } = require("./src/db/database");
const { runMigrationTests } = require("./test_migration");

const URL = "http://localhost:4000";
let passed = 0, failed = 0;

function check(label, cond) {
  if (cond) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log("==================================================");
  console.log("       Starting Sparq Comprehensive E2E Tests     ");
  console.log("==================================================");

  // -------------------------------------------------------------------------
  // 0. SQLite Database Migration Tests (Fresh, Existing, Legacy, Error Cases)
  // -------------------------------------------------------------------------
  const migrationResults = runMigrationTests();
  passed += migrationResults.passed;
  failed += migrationResults.failed;

  // -------------------------------------------------------------------------
  // 1. REST Authentication & Zod Validation Tests
  // -------------------------------------------------------------------------
  console.log("\n--- Testing REST Auth & JWT Security ---");
  const testUsername = `TestHost_${Date.now().toString(36)}`;
  const testPassword = "Password123!";

  // 1a. Test Registration
  const regRes = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, password: testPassword }),
  });
  const regData = await regRes.json();
  check("Auth: Host registration succeeded with JWT", regRes.status === 201 && !!regData.token);

  // 1b. Test Duplicate Registration (Should be 409 Conflict)
  const dupRegRes = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, password: testPassword }),
  });
  check("Auth: Duplicate registration blocked with 409", dupRegRes.status === 409);

  // 1c. Test Login
  const loginRes = await fetch(`${URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: testUsername, password: testPassword }),
  });
  const loginData = await loginRes.json();
  check("Auth: Host login succeeded and returned valid token", loginRes.status === 200 && !!loginData.token);
  const hostJwt = loginData.token;

  // -------------------------------------------------------------------------
  // 2. Private Quiz Bank & Authorization Tests
  // -------------------------------------------------------------------------
  console.log("\n--- Testing Quiz Bank User Isolation & JWT Guard ---");

  // 2a. Attempt save without JWT (Should be 401 Unauthorized)
  const unauthSaveRes = await fetch(`${URL}/api/quiz/bank/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Hacked Template",
      questions: [{ questionText: "q?", options: ["a","b","c","d"], correctOption: "A", timeLimit: 20 }]
    }),
  });
  check("Quiz Bank: Unauthorized save blocked with 401", unauthSaveRes.status === 401);

  // 2b. Authorized save with JWT
  const authSaveRes = await fetch(`${URL}/api/quiz/bank/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${hostJwt}`
    },
    body: JSON.stringify({
      title: "Algorithms Master",
      questions: [
        { questionText: "Time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correctOption: "B", timeLimit: 15 }
      ]
    }),
  });
  const authSaveData = await authSaveRes.json();
  check("Quiz Bank: Save quiz template succeeded with JWT", authSaveRes.status === 200 && !!authSaveData.quizId);

  // 2c. Load from Bank
  const loadRes = await fetch(`${URL}/api/quiz/bank/load`, {
    headers: { "Authorization": `Bearer ${hostJwt}` }
  });
  const loadData = await loadRes.json();
  check("Quiz Bank: Load private templates retrieved saved quiz", loadData.success && loadData.quizzes.some(q => q.title === "Algorithms Master"));

  // -------------------------------------------------------------------------
  // 3. AI Question Generator & Fallback Test
  // -------------------------------------------------------------------------
  console.log("\n--- Testing AI Generator / Fallback ---");
  const aiGenRes = await fetch(`${URL}/api/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: "Networking", numQuestions: 3, globalTimeLimit: 15 })
  });
  const aiGenData = await aiGenRes.json();
  check("AI Generator: Returned valid structured questions array", aiGenData.success && Array.isArray(aiGenData.questions) && aiGenData.questions.length === 3);

  // -------------------------------------------------------------------------
  // 4. Room Creation via REST API (Rooms A and B)
  // -------------------------------------------------------------------------
  console.log("\n--- Testing Quiz Room Creation ---");
  const createRoomRes = await fetch(`${URL}/api/quiz/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hostName: "TestMaster",
      mode: "Classic",
      questions: [
        { questionText: "2 + 2 = ?", options: ["3", "4", "5", "6"], correctOption: "B", timeLimit: 5 },
        { questionText: "Capital of France?", options: ["Berlin", "Rome", "Paris", "Madrid"], correctOption: "C", timeLimit: 5 },
      ]
    })
  });
  const createRoomData = await createRoomRes.json();
  const roomCode = createRoomData.roomCode;
  const hostToken = createRoomData.hostToken;

  check("Room Creation: Received 6-char code and cryptographic hostToken", createRoomData.success && roomCode.length === 6 && !!hostToken);

  // Create a second room B to test cross-room token leakage / spoofing
  const createRoomB = await fetch(`${URL}/api/quiz/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hostName: "OtherHost",
      mode: "Classic",
      questions: [{ questionText: "1+1?", options: ["1","2","3","4"], correctOption: "B", timeLimit: 10 }]
    })
  });
  const dataB = await createRoomB.json();
  const roomCodeB = dataB.roomCode;
  const hostTokenB = dataB.hostToken;

  // -------------------------------------------------------------------------
  // 5. Host Authorization Attack Vector Testing
  // -------------------------------------------------------------------------
  console.log("\n--- Testing Strict Host Authorization & Privilege Escalation Defenses ---");
  const attacker = io(URL);
  await new Promise((r) => attacker.on("connect", r));

  // 5a. Attacker attempts host:joinRoom with missing token
  const noTokenJoin = await new Promise((resolve) => {
    attacker.emit("host:joinRoom", { roomCode, hostToken: "" }, resolve);
  });
  check("Auth Defense: host:joinRoom rejected when token is missing", noTokenJoin.error && noTokenJoin.error.includes("Unauthorized"));

  // 5b. Attacker attempts host:joinRoom with incorrect token
  const wrongTokenJoin = await new Promise((resolve) => {
    attacker.emit("host:joinRoom", { roomCode, hostToken: "fake_invalid_token_999999" }, resolve);
  });
  check("Auth Defense: host:joinRoom rejected when token is incorrect", wrongTokenJoin.error && wrongTokenJoin.error.includes("Unauthorized"));

  // 5c. Attacker attempts host:joinRoom using a token from a DIFFERENT room (Room B's token on Room A)
  const crossRoomJoin = await new Promise((resolve) => {
    attacker.emit("host:joinRoom", { roomCode, hostToken: hostTokenB }, resolve);
  });
  check("Auth Defense: host:joinRoom rejected when using token from another room", crossRoomJoin.error && crossRoomJoin.error.includes("Unauthorized"));

  // 5d. Player who knows only roomCode attempts host:startQuiz directly
  const unauthStart = await new Promise((resolve) => {
    attacker.emit("host:startQuiz", { roomCode }, resolve);
  });
  check("Auth Defense: host:startQuiz rejected without host privileges", unauthStart.error && unauthStart.error.includes("Unauthorized"));

  // 5e. Attacker attempts host:startQuiz with wrong token
  const wrongTokenStart = await new Promise((resolve) => {
    attacker.emit("host:startQuiz", { roomCode, hostToken: "invalid_token_xyz" }, resolve);
  });
  check("Auth Defense: host:startQuiz rejected with invalid hostToken in payload", wrongTokenStart.error && wrongTokenStart.error.includes("Unauthorized"));

  // 5f. Attacker attempts host:nextQuestion without privileges
  const unauthNext = await new Promise((resolve) => {
    attacker.emit("host:nextQuestion", { roomCode }, resolve);
  });
  check("Auth Defense: host:nextQuestion rejected without host privileges", unauthNext.error && unauthNext.error.includes("Unauthorized"));

  // 5g. Test legacy room with NULL host_token in database (must NEVER bypass authorization)
  db.prepare("INSERT INTO rooms (code, host_name, status, host_token) VALUES ('LEGACY', 'OldHost', 'WAITING', NULL)").run();
  const legacyJoin = await new Promise((resolve) => {
    attacker.emit("host:joinRoom", { roomCode: "LEGACY", hostToken: "anything" }, resolve);
  });
  const legacyStart = await new Promise((resolve) => {
    attacker.emit("host:startQuiz", { roomCode: "LEGACY", hostToken: "anything" }, resolve);
  });
  check("Auth Defense: Legacy room with NULL host_token rejects host:joinRoom", legacyJoin.error && legacyJoin.error.includes("Unauthorized"));
  check("Auth Defense: Legacy room with NULL host_token rejects host:startQuiz", legacyStart.error && legacyStart.error.includes("Unauthorized"));
  // Clean up test legacy room
  db.prepare("DELETE FROM rooms WHERE code = 'LEGACY'").run();

  // -------------------------------------------------------------------------
  // 6. Legitimate WebSocket Gameplay & Player Attack Vector Testing
  // -------------------------------------------------------------------------
  console.log("\n--- Testing Legitimate Host & Multiplayer Gameplay Flow ---");
  const host = io(URL);
  const p1 = io(URL);
  const p2 = io(URL);

  await new Promise((r) => host.on("connect", r));
  await new Promise((r) => p1.on("connect", r));
  await new Promise((r) => p2.on("connect", r));

  // 6a. Legitimate Host joins room with valid hostToken
  const hostJoinRes = await new Promise((resolve) => {
    host.emit("host:joinRoom", { roomCode, hostToken }, resolve);
  });
  check("Host: Successfully joined room with legitimate host authorization", hostJoinRes.ok && hostJoinRes.status === "WAITING");

  // 6b. Two players join room
  let lobbyCount = 0;
  host.on("lobby:update", (d) => { lobbyCount = d.participantCount; });

  const p1Data = await new Promise((resolve) => p1.emit("player:join", { roomCode, name: "Alice" }, resolve));
  const p2Data = await new Promise((resolve) => p2.emit("player:join", { roomCode, name: "Bob" }, resolve));
  check("Players: Alice received secure session token", !!p1Data.token && p1Data.token.length >= 24);
  check("Players: Bob received secure session token", !!p2Data.token && p2Data.token.length >= 24);

  // 6c. Player Alice attempts to control quiz using her player token as hostToken
  const playerEscalation = await new Promise((resolve) => {
    p1.emit("host:startQuiz", { roomCode, hostToken: p1Data.token }, resolve);
  });
  check("Auth Defense: Player cannot escalate privileges using participant token", playerEscalation.error && playerEscalation.error.includes("Unauthorized"));

  await new Promise((r) => setTimeout(r, 200));
  check("Lobby: Host sees 2 connected participants", lobbyCount === 2);

  // 6d. Legitimate Host starts quiz
  const q1Promise = new Promise((resolve) => p1.once("question:show", resolve));
  const startQuizRes = await new Promise((resolve) => {
    host.emit("host:startQuiz", { roomCode, hostToken }, resolve);
  });
  check("Host: Authorized startQuiz succeeded", startQuizRes.ok === true);

  const q1 = await q1Promise;
  check("Question Broadcast: Question 1 received by Alice", q1.questionText === "2 + 2 = ?");
  check("Question Timing: Server-authoritative deadline is in future", q1.deadline > Date.now());

  // 6e. Both players answer: Alice fast+correct (B), Bob slow+incorrect (A)
  const aliceAnswer = await new Promise((resolve) => {
    p1.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "B" }, resolve);
  });
  check("Answer Submission: Alice's correct answer accepted", aliceAnswer.ok && aliceAnswer.isCorrect);
  check("Answer Scoring: Alice awarded speed bonus + base points", aliceAnswer.points >= 500);

  await new Promise((r) => setTimeout(r, 500));
  const bobAnswer = await new Promise((resolve) => {
    p2.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "A" }, resolve);
  });
  check("Answer Submission: Bob's wrong answer recorded with 0 points", bobAnswer.ok && !bobAnswer.isCorrect && bobAnswer.points === 0);

  // 6f. Anti-Cheat: Prevent duplicate submissions
  const doubleSubmit = await new Promise((resolve) => {
    p1.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "B" }, resolve);
  });
  check("Anti-Cheat: Duplicate submission rejected", !!doubleSubmit.error);

  // 6g. Server-authoritative timer expires and reveals answer
  const endedPromise = new Promise((resolve) => p1.once("question:ended", resolve));
  const leaderboardPromise = new Promise((resolve) => p1.once("leaderboard:update", resolve));
  const ended = await endedPromise;
  check("Server Timer: Question auto-ended by server timer", ended.correctOption === "B");
  check("Host Tally: Option counts recorded (1 for B, 1 for A)", ended.optionCounts.B === 1 && ended.optionCounts.A === 1);
  check("Fastest Responder: Alice identified as fastest responder", ended.fastestResponder && ended.fastestResponder.name === "Alice");

  const lb = await leaderboardPromise;
  check("Leaderboard: Alice ranked #1 above Bob", lb.leaderboard[0].name === "Alice" && lb.leaderboard[0].score > 0);

  // 6h. Reconnection Test: Simulate Bob refreshing page / dropping connection
  const bobReconnect = io(URL);
  await new Promise((r) => bobReconnect.on("connect", r));
  const rejoinResult = await new Promise((resolve) => {
    bobReconnect.emit("player:rejoin", { roomCode, token: p2Data.token }, resolve);
  });
  check("Reconnection: Bob successfully recovered session via token", rejoinResult.ok && rejoinResult.name === "Bob");
  check("Reconnection: Bob's score preserved after reconnection", rejoinResult.score === 0);

  // 6i. Host advances to Question 2, lets timer elapse, then finalizes quiz
  const q2Promise = new Promise((resolve) => p1.once("question:show", resolve));
  host.emit("host:nextQuestion", { roomCode, hostToken });
  const q2 = await q2Promise;
  check("Question Broadcast: Question 2 broadcasted correctly", q2.questionText.includes("Capital of France"));

  const finishedPromise = new Promise((resolve) => p1.once("quiz:finished", resolve));
  // Allow Question 2 timer to expire (5s + buffer)
  await new Promise((r) => setTimeout(r, 5500));
  host.emit("host:nextQuestion", { roomCode, hostToken });
  const finished = await finishedPromise;

  check("Quiz Finalization: Final podium broadcasted with participants", finished.finalLeaderboard.length === 2);
  check("Analytics: Question stats generated with difficulty ratings", finished.perQuestionStats.length === 2 && !!finished.perQuestionStats[0].difficulty);

  // Disconnect sockets cleanly
  host.disconnect();
  p1.disconnect();
  p2.disconnect();
  bobReconnect.disconnect();
  attacker.disconnect();

  console.log("==================================================");
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
