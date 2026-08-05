const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { db, generateRoomCode, generateToken } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // fine for a student project; in production you'd lock this to your frontend's domain
});

const PORT = process.env.PORT || 4000;

app.get("/health", (req, res) => res.json({ status: "Quiz server is running" }));

// -------------------------------------------------------------------------
// In-memory state for ACTIVE rooms only. This is separate from the database:
// the database is the permanent record (for history/analytics after the quiz
// ends), while this in-memory map tracks fast-changing, transient state
// (the current question's deadline, live answer tally) that we don't want
// to hit SQLite for on every single tick or answer.
// -------------------------------------------------------------------------
const activeRooms = new Map();
// activeRooms.get(code) = {
//   hostSocketId,
//   currentQuestion: { id, startTime, deadline, timeLimitSeconds },
//   optionCounts: { A: 0, B: 0, C: 0, D: 0 },
//   questionTimer: <setTimeout handle>
// }

function getRoomByCode(code) {
  return db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
}

function getQuestionsForRoom(roomId) {
  return db
    .prepare("SELECT * FROM questions WHERE room_id = ? ORDER BY order_index ASC")
    .all(roomId);
}

function getLeaderboard(roomId) {
  return db
    .prepare(
      "SELECT name, score FROM participants WHERE room_id = ? ORDER BY score DESC, joined_at ASC"
    )
    .all(roomId);
}

// Sends a question to everyone in the room and starts its server-side deadline.
function broadcastQuestion(roomCode) {
  const room = getRoomByCode(roomCode);
  const questions = getQuestionsForRoom(room.id);
  const question = questions[room.current_question_index];

  const timeLimitMs = question.time_limit_seconds * 1000;
  const startTime = Date.now();
  const deadline = startTime + timeLimitMs;

  activeRooms.set(roomCode, {
    ...activeRooms.get(roomCode),
    currentQuestion: { id: question.id, startTime, deadline, timeLimitSeconds: question.time_limit_seconds },
    optionCounts: { A: 0, B: 0, C: 0, D: 0 },
  });

  io.to(roomCode).emit("question:show", {
    questionId: question.id,
    questionText: question.question_text,
    options: {
      A: question.option_a,
      B: question.option_b,
      C: question.option_c,
      D: question.option_d,
    },
    deadline, // client computes its own countdown display from this timestamp
    questionNumber: room.current_question_index + 1,
    totalQuestions: questions.length,
  });

  // Server-side auto-cutoff - this fires regardless of what any client does,
  // which is what makes the timer "authoritative" rather than advisory.
  const timerHandle = setTimeout(() => endQuestion(roomCode), timeLimitMs + 300); // +300ms network buffer
  activeRooms.get(roomCode).questionTimer = timerHandle;
}

function endQuestion(roomCode) {
  const state = activeRooms.get(roomCode);
  if (!state || !state.currentQuestion) return;

  clearTimeout(state.questionTimer);
  const room = getRoomByCode(roomCode);
  const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(state.currentQuestion.id);

  const totalAnswered = Object.values(state.optionCounts).reduce((a, b) => a + b, 0);

  io.to(roomCode).emit("question:ended", {
    correctOption: question.correct_option,
    optionCounts: state.optionCounts,
    totalAnswered,
  });

  io.to(roomCode).emit("leaderboard:update", { leaderboard: getLeaderboard(room.id) });

  activeRooms.set(roomCode, { ...state, currentQuestion: null });
}

function finalizeQuiz(roomCode) {
  const room = getRoomByCode(roomCode);
  db.prepare("UPDATE rooms SET status = 'finished' WHERE id = ?").run(room.id);

  const questions = getQuestionsForRoom(room.id);
  const perQuestionStats = questions.map((q) => {
    const answers = db.prepare("SELECT * FROM answers WHERE question_id = ?").all(q.id);
    const correctCount = answers.filter((a) => a.is_correct).length;
    const avgResponseMs = answers.length
      ? Math.round(answers.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / answers.length)
      : 0;
    return {
      questionText: q.question_text,
      totalAnswered: answers.length,
      correctCount,
      accuracyPct: answers.length ? Math.round((correctCount / answers.length) * 100) : 0,
      avgResponseMs,
    };
  });

  io.to(roomCode).emit("quiz:finished", {
    finalLeaderboard: getLeaderboard(room.id),
    perQuestionStats,
  });

  activeRooms.delete(roomCode);
}

io.on("connection", (socket) => {
  // ---------------- HOST EVENTS ----------------

  socket.on("host:createRoom", ({ hostName, questions }, ack) => {
    if (!hostName || !questions || questions.length === 0) {
      return ack({ error: "Host name and at least one question are required." });
    }

    const code = generateRoomCode();
    const roomInsert = db
      .prepare("INSERT INTO rooms (code, host_name) VALUES (?, ?)")
      .run(code, hostName);
    const roomId = roomInsert.lastInsertRowid;

    const insertQuestion = db.prepare(`
      INSERT INTO questions (room_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    questions.forEach((q, i) => {
      insertQuestion.run(
        roomId,
        q.questionText,
        q.options[0],
        q.options[1],
        q.options[2],
        q.options[3],
        q.correctOption,
        q.timeLimit || 20,
        i
      );
    });

    socket.join(code);
    activeRooms.set(code, { hostSocketId: socket.id, currentQuestion: null, optionCounts: {} });

    ack({ roomCode: code });
  });

  socket.on("host:startQuiz", ({ roomCode }) => {
    const room = getRoomByCode(roomCode);
    if (!room) return;
    db.prepare("UPDATE rooms SET status = 'active', current_question_index = 0 WHERE id = ?").run(room.id);
    io.to(roomCode).emit("quiz:started");
    broadcastQuestion(roomCode);
  });

  socket.on("host:nextQuestion", ({ roomCode }) => {
    const room = getRoomByCode(roomCode);
    if (!room) return;
    const questions = getQuestionsForRoom(room.id);
    const nextIndex = room.current_question_index + 1;

    if (nextIndex >= questions.length) {
      finalizeQuiz(roomCode);
      return;
    }

    db.prepare("UPDATE rooms SET current_question_index = ? WHERE id = ?").run(nextIndex, room.id);
    broadcastQuestion(roomCode);
  });

  socket.on("host:rejoin", ({ roomCode }, ack) => {
    const room = getRoomByCode(roomCode);
    if (!room) return ack({ error: "Room not found" });
    socket.join(roomCode);
    const state = activeRooms.get(roomCode) || {};
    activeRooms.set(roomCode, { ...state, hostSocketId: socket.id });
    ack({ ok: true, status: room.status });
  });

  // ---------------- PARTICIPANT EVENTS ----------------

  socket.on("player:join", ({ roomCode, name }, ack) => {
    const room = getRoomByCode(roomCode);
    if (!room) return ack({ error: "Room not found. Check the code and try again." });
    if (room.status !== "waiting") return ack({ error: "This quiz has already started." });

    const token = generateToken();
    const result = db
      .prepare("INSERT INTO participants (room_id, token, name) VALUES (?, ?, ?)")
      .run(room.id, token, name);

    socket.join(roomCode);
    socket.data.participantId = result.lastInsertRowid;
    socket.data.roomCode = roomCode;

    const participantCount = db
      .prepare("SELECT COUNT(*) as count FROM participants WHERE room_id = ?")
      .get(room.id).count;
    io.to(roomCode).emit("lobby:update", { participantCount });

    ack({ token, participantId: result.lastInsertRowid });
  });

  // Reconnection: a dropped phone can rejoin using its saved token and keep its score.
  socket.on("player:rejoin", ({ roomCode, token }, ack) => {
    const participant = db.prepare("SELECT * FROM participants WHERE token = ?").get(token);
    if (!participant) return ack({ error: "Session not found." });

    db.prepare("UPDATE participants SET connected = 1 WHERE id = ?").run(participant.id);
    socket.join(roomCode);
    socket.data.participantId = participant.id;
    socket.data.roomCode = roomCode;

    const room = getRoomByCode(roomCode);
    const state = activeRooms.get(roomCode);

    ack({
      ok: true,
      name: participant.name,
      score: participant.score,
      roomStatus: room.status,
      currentQuestion: state?.currentQuestion || null,
    });
  });

  socket.on("player:submitAnswer", ({ roomCode, questionId, selectedOption }, ack) => {
    const state = activeRooms.get(roomCode);
    const participantId = socket.data.participantId;

    if (!state || !state.currentQuestion || state.currentQuestion.id !== questionId) {
      return ack({ error: "This question is no longer active." });
    }
    if (Date.now() > state.currentQuestion.deadline + 300) {
      return ack({ error: "Time's up." });
    }

    // Prevent double-submission for the same question
    const alreadyAnswered = db
      .prepare("SELECT id FROM answers WHERE question_id = ? AND participant_id = ?")
      .get(questionId, participantId);
    if (alreadyAnswered) return ack({ error: "You already answered this question." });

    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId);
    const responseTimeMs = Date.now() - state.currentQuestion.startTime;
    const isCorrect = selectedOption === question.correct_option;

    // Speed-based scoring: correct answers score between 500-1000 points,
    // scaled by how much time was left when they answered. Wrong = 0.
    let points = 0;
    if (isCorrect) {
      const timeLimitMs = state.currentQuestion.timeLimitSeconds * 1000;
      const remainingRatio = Math.max(0, (timeLimitMs - responseTimeMs) / timeLimitMs);
      points = Math.round(500 + 500 * remainingRatio);
    }

    db.prepare(`
      INSERT INTO answers (room_id, question_id, participant_id, selected_option, is_correct, response_time_ms, points_awarded)
      VALUES ((SELECT room_id FROM questions WHERE id = ?), ?, ?, ?, ?, ?, ?)
    `).run(questionId, questionId, participantId, selectedOption, isCorrect ? 1 : 0, responseTimeMs, points);

    db.prepare("UPDATE participants SET score = score + ? WHERE id = ?").run(points, participantId);

    if (selectedOption in state.optionCounts) state.optionCounts[selectedOption]++;

    // Live tally to the host's control panel (bar chart updates as answers come in)
    io.to(roomCode).emit("results:tally", { optionCounts: state.optionCounts });

    ack({ ok: true, isCorrect, points });
  });

  socket.on("disconnect", () => {
    if (socket.data.participantId) {
      db.prepare("UPDATE participants SET connected = 0 WHERE id = ?").run(socket.data.participantId);
      if (socket.data.roomCode) {
        const room = getRoomByCode(socket.data.roomCode);
        if (room) {
          const participantCount = db
            .prepare("SELECT COUNT(*) as count FROM participants WHERE room_id = ?")
            .get(room.id).count;
          io.to(socket.data.roomCode).emit("lobby:update", { participantCount });
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Quiz server running on http://localhost:${PORT}`);
});
