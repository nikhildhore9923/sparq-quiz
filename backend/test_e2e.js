const { io } = require("socket.io-client");

const URL = "http://localhost:4000";
let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { console.log(`PASS: ${label}`); passed++; }
  else { console.log(`FAIL: ${label}`); failed++; }
}

async function run() {
  const host = io(URL);
  const p1 = io(URL);
  const p2 = io(URL);

  await new Promise((r) => host.on("connect", r));
  await new Promise((r) => p1.on("connect", r));
  await new Promise((r) => p2.on("connect", r));

  // 1. Host creates room with 2 fast questions
  const roomCode = await new Promise((resolve) => {
    host.emit("host:createRoom", {
      hostName: "TestHost",
      questions: [
        { questionText: "2+2?", options: ["3", "4", "5", "6"], correctOption: "B", timeLimit: 3 },
        { questionText: "Capital of France?", options: ["Berlin", "Rome", "Paris", "Madrid"], correctOption: "C", timeLimit: 3 },
      ],
    }, (res) => resolve(res.roomCode));
  });
  check("Room created with a code", !!roomCode && roomCode.length === 6);

  let lobbyCount = 0;
  host.on("lobby:update", (d) => { lobbyCount = d.participantCount; });

  // 2. Two players join
  const p1Data = await new Promise((resolve) => p1.emit("player:join", { roomCode, name: "Alice" }, resolve));
  const p2Data = await new Promise((resolve) => p2.emit("player:join", { roomCode, name: "Bob" }, resolve));
  check("Player 1 joined with a token", !!p1Data.token);
  check("Player 2 joined with a token", !!p2Data.token);

  await new Promise((r) => setTimeout(r, 200));
  check("Host sees 2 participants in lobby", lobbyCount === 2);

  // 3. Host starts quiz
  const q1Promise = new Promise((resolve) => {
    p1.once("question:show", resolve);
  });
  host.emit("host:startQuiz", { roomCode });
  const q1 = await q1Promise;
  check("Question 1 broadcast to player", q1.questionText === "2+2?");
  check("Question has a deadline in the future", q1.deadline > Date.now());

  // 4. Both players answer - Alice fast+correct, Bob slow+wrong
  const aliceAnswer = await new Promise((resolve) => {
    p1.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "B" }, resolve);
  });
  check("Alice's correct answer accepted", aliceAnswer.ok && aliceAnswer.isCorrect);
  check("Alice earned points for correct answer", aliceAnswer.points > 0);

  await new Promise((r) => setTimeout(r, 800)); // Bob answers later -> should score fewer points than Alice
  const bobAnswer = await new Promise((resolve) => {
    p2.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "A" }, resolve);
  });
  check("Bob's wrong answer scores 0", bobAnswer.ok && !bobAnswer.isCorrect && bobAnswer.points === 0);

  // 5. Double-submit should be rejected
  const doubleSubmit = await new Promise((resolve) => {
    p1.emit("player:submitAnswer", { roomCode, questionId: q1.questionId, selectedOption: "A" }, resolve);
  });
  check("Double-submission rejected", !!doubleSubmit.error);

  // 6. Wait for server-side timer to auto-end the question
  const endedPromise = new Promise((resolve) => p1.once("question:ended", resolve));
  const leaderboardPromise = new Promise((resolve) => p1.once("leaderboard:update", resolve));
  const ended = await endedPromise;
  check("Question auto-ended by server timer", ended.correctOption === "B");
  check("Tally shows 1 correct (A) + 1 wrong (B... wait check counts)", ended.optionCounts.B === 1 && ended.optionCounts.A === 1);

  const lb = await leaderboardPromise;
  check("Leaderboard has 2 players", lb.leaderboard.length === 2);
  check("Alice ranks above Bob (answered correctly)", lb.leaderboard[0].name === "Alice" && lb.leaderboard[0].score > 0);

  // 7. Reconnection test: simulate Bob's phone dropping and rejoining
  const bobReconnect = io(URL);
  await new Promise((r) => bobReconnect.on("connect", r));
  const rejoinResult = await new Promise((resolve) => {
    bobReconnect.emit("player:rejoin", { roomCode, token: p2Data.token }, resolve);
  });
  check("Bob can rejoin with saved token", rejoinResult.ok && rejoinResult.name === "Bob");
  check("Bob's score preserved after reconnect (should be 0)", rejoinResult.score === 0);

  // 8. Host advances to question 2, then finishes quiz
  const q2Promise = new Promise((resolve) => p1.once("question:show", resolve));
  host.emit("host:nextQuestion", { roomCode });
  const q2 = await q2Promise;
  check("Question 2 broadcast correctly", q2.questionText.includes("Capital"));

  const finishedPromise = new Promise((resolve) => p1.once("quiz:finished", resolve));
  // let question 2 timeout without answers, then advance past the last question
  await new Promise((r) => setTimeout(r, 3500));
  host.emit("host:nextQuestion", { roomCode }); // no more questions -> should finalize
  const finished = await finishedPromise;
  check("Quiz finalized with final leaderboard", finished.finalLeaderboard.length === 2);
  check("Per-question stats generated for both questions", finished.perQuestionStats.length === 2);
  check("Q1 stats show 100% accuracy is wrong (1/2 correct = 50%)", finished.perQuestionStats[0].accuracyPct === 50);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("Test crashed:", e); process.exit(1); });
