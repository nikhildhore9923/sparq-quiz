const { db, generateRoomCode, generateToken } = require('../db/database');

const activeRooms = new Map();
// State Machine Statuses: WAITING, STARTING, QUESTION_ACTIVE, QUESTION_ENDED, FINISHED

function getRoomByCode(code) {
  if (!code || typeof code !== 'string') return null;
  return db.prepare("SELECT * FROM rooms WHERE code = ?").get(code.trim().toUpperCase());
}

function getQuestionsForRoom(roomId) {
  return db.prepare("SELECT * FROM questions WHERE room_id = ? ORDER BY order_index ASC").all(roomId);
}

function getLeaderboard(roomId) {
  return db.prepare(
    "SELECT name, score FROM participants WHERE room_id = ? ORDER BY score DESC, joined_at ASC"
  ).all(roomId);
}

function setupSocketIO(io) {

  // Emit questions and handle timer
  function broadcastQuestion(roomCode) {
    const room = getRoomByCode(roomCode);
    if (!room) return;
    const questions = getQuestionsForRoom(room.id);
    if (!questions || room.current_question_index >= questions.length) {
      finalizeQuiz(roomCode);
      return;
    }

    const question = questions[room.current_question_index];

    let timeLimitSeconds = question.time_limit_seconds;
    if (room.mode === 'Rapid Fire') {
      timeLimitSeconds = Math.max(5, Math.floor(timeLimitSeconds / 2));
    }

    const timeLimitMs = timeLimitSeconds * 1000;
    const startTime = Date.now();
    const deadline = startTime + timeLimitMs;

    db.prepare("UPDATE rooms SET status = 'QUESTION_ACTIVE' WHERE id = ?").run(room.id);

    const existingState = activeRooms.get(roomCode) || {};
    activeRooms.set(roomCode, {
      ...existingState,
      currentQuestion: { id: question.id, startTime, deadline, timeLimitSeconds },
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
      deadline,
      questionNumber: room.current_question_index + 1,
      totalQuestions: questions.length,
      mode: room.mode,
    });

    // Clear existing timer if any
    if (existingState.questionTimer) {
      clearTimeout(existingState.questionTimer);
    }

    const timerHandle = setTimeout(() => endQuestion(roomCode), timeLimitMs + 300);
    activeRooms.get(roomCode).questionTimer = timerHandle;
  }

  function endQuestion(roomCode) {
    const state = activeRooms.get(roomCode);
    if (!state || !state.currentQuestion) return;
    if (state.questionTimer) clearTimeout(state.questionTimer);

    const room = getRoomByCode(roomCode);
    if (!room) return;

    // Strict state transition
    if (room.status !== 'QUESTION_ACTIVE') return;

    db.prepare("UPDATE rooms SET status = 'QUESTION_ENDED' WHERE id = ?").run(room.id);

    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(state.currentQuestion.id);
    const answers = db.prepare(
      "SELECT a.*, p.name FROM answers a JOIN participants p ON a.participant_id = p.id WHERE a.question_id = ?"
    ).all(state.currentQuestion.id);

    const totalAnswered = answers.length;
    let fastestResponder = null;

    if (totalAnswered > 0) {
      const correctAnswers = answers.filter(a => a.is_correct === 1);
      if (correctAnswers.length > 0) {
        correctAnswers.sort((a, b) => a.response_time_ms - b.response_time_ms);
        fastestResponder = {
          name: correctAnswers[0].name,
          time: correctAnswers[0].response_time_ms
        };
      }
    }

    io.to(roomCode).emit("question:ended", {
      correctOption: question ? question.correct_option : 'A',
      optionCounts: state.optionCounts,
      totalAnswered,
      fastestResponder
    });

    io.to(roomCode).emit("leaderboard:update", { leaderboard: getLeaderboard(room.id) });

    activeRooms.set(roomCode, { ...state, currentQuestion: null });
  }

  function finalizeQuiz(roomCode) {
    const room = getRoomByCode(roomCode);
    if (!room) return;
    db.prepare("UPDATE rooms SET status = 'FINISHED' WHERE id = ?").run(room.id);

    const questions = getQuestionsForRoom(room.id);
    const perQuestionStats = questions.map((q) => {
      const answers = db.prepare("SELECT * FROM answers WHERE question_id = ?").all(q.id);
      const correctCount = answers.filter((a) => a.is_correct === 1).length;
      const avgResponseMs = answers.length
        ? Math.round(answers.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / answers.length)
        : 0;
      const accuracyPct = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
      let difficulty = "Medium";
      if (accuracyPct < 40) difficulty = "Hard";
      if (accuracyPct > 75) difficulty = "Easy";

      return {
        questionText: q.question_text,
        totalAnswered: answers.length,
        correctCount,
        accuracyPct,
        avgResponseMs,
        difficulty,
      };
    });

    io.to(roomCode).emit("quiz:finished", {
      finalLeaderboard: getLeaderboard(room.id),
      perQuestionStats,
    });

    activeRooms.delete(roomCode);
  }

  function isHostAuthorized(socket, room, suppliedToken) {
    if (!room || !room.host_token) {
      return false; // Never authorize if room is invalid or host_token is missing
    }

    // 1. If the socket was already authenticated for this exact room during host:joinRoom
    if (socket.data && socket.data.isHost === true && socket.data.hostRoomCode === room.code) {
      return true;
    }

    // 2. Or if a valid host token matching THIS specific room is explicitly provided in the event payload
    if (suppliedToken && typeof suppliedToken === 'string' && suppliedToken === room.host_token) {
      return true;
    }

    return false;
  }

  io.on("connection", (socket) => {

    // ---------------- HOST EVENTS ----------------

    // Programmatic room creation over Socket (for automated tests / socket clients)
    socket.on("host:createRoom", ({ hostName, questions, mode = 'Classic' }, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      try {
        const code = generateRoomCode();
        const hostToken = generateToken();
        const insertQuiz = db.transaction(() => {
          const roomInsert = db.prepare(
            "INSERT INTO rooms (code, host_name, mode, status, host_token) VALUES (?, ?, ?, 'WAITING', ?)"
          ).run(code, hostName || "Host", mode, hostToken);
          const roomId = roomInsert.lastInsertRowid;

          const insertQuestion = db.prepare(`
            INSERT INTO questions (room_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          (questions || []).forEach((q, i) => {
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
          return { code, hostToken };
        });

        const res = insertQuiz();
        socket.join(res.code);
        socket.data.isHost = true;
        socket.data.hostRoomCode = res.code;
        activeRooms.set(res.code, { hostSocketId: socket.id, currentQuestion: null, optionCounts: { A:0, B:0, C:0, D:0 } });
        ack({ roomCode: res.code, hostToken: res.hostToken });
      } catch (err) {
        ack({ error: err.message });
      }
    });

    socket.on("host:joinRoom", ({ roomCode, hostToken }, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = getRoomByCode(roomCode);
      if (!room) return ack({ error: "Room not found" });

      // Strictly require a valid host token for this specific room
      if (!room.host_token || !hostToken || typeof hostToken !== 'string' || hostToken !== room.host_token) {
        return ack({ error: "Unauthorized: Invalid or missing host token" });
      }

      socket.join(roomCode);
      socket.data.isHost = true;
      socket.data.hostRoomCode = room.code;

      // Initialize or update active room state
      if (!activeRooms.has(roomCode)) {
        activeRooms.set(roomCode, { hostSocketId: socket.id, currentQuestion: null, optionCounts: { A:0, B:0, C:0, D:0 } });
      } else {
        const state = activeRooms.get(roomCode);
        activeRooms.set(roomCode, { ...state, hostSocketId: socket.id });
      }

      // Safe recovery if server restarted while in QUESTION_ACTIVE
      let effectiveStatus = room.status;
      if (room.status === 'QUESTION_ACTIVE' && !activeRooms.get(roomCode).currentQuestion) {
        db.prepare("UPDATE rooms SET status = 'QUESTION_ENDED' WHERE id = ?").run(room.id);
        effectiveStatus = 'QUESTION_ENDED';
      }

      ack({ ok: true, status: effectiveStatus, mode: room.mode });
    });

    socket.on("host:startQuiz", ({ roomCode, hostToken }, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = getRoomByCode(roomCode);
      if (!room) {
        return ack({ error: "Room not found" });
      }

      // Verify caller is strictly authorized for this room FIRST
      if (!isHostAuthorized(socket, room, hostToken)) {
        return ack({ error: "Unauthorized: host privileges required" });
      }

      if (room.status !== 'WAITING') {
        return ack({ error: "Cannot start quiz: room not in WAITING state" });
      }

      db.prepare("UPDATE rooms SET status = 'STARTING', current_question_index = 0 WHERE id = ?").run(room.id);
      io.to(roomCode).emit("quiz:started");

      // 2-second countdown before first question
      setTimeout(() => broadcastQuestion(roomCode), 2000);
      ack({ ok: true });
    });

    socket.on("host:nextQuestion", ({ roomCode, hostToken }, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      const room = getRoomByCode(roomCode);
      if (!room) {
        return ack({ error: "Room not found" });
      }

      // Verify caller is strictly authorized for this room FIRST
      if (!isHostAuthorized(socket, room, hostToken)) {
        return ack({ error: "Unauthorized: host privileges required" });
      }

      if (room.status !== 'QUESTION_ENDED') {
        return ack({ error: "Cannot advance: question not in QUESTION_ENDED state" });
      }

      const questions = getQuestionsForRoom(room.id);
      const nextIndex = room.current_question_index + 1;

      if (nextIndex >= questions.length) {
        finalizeQuiz(roomCode);
        return ack({ ok: true, finished: true });
      }

      db.prepare("UPDATE rooms SET current_question_index = ? WHERE id = ?").run(nextIndex, room.id);
      broadcastQuestion(roomCode);
      ack({ ok: true, nextIndex });
    });

    // ---------------- PARTICIPANT EVENTS ----------------
    socket.on("player:join", ({ roomCode, name }, ack) => {
      if (typeof ack !== 'function') ack = () => {};

      if (!roomCode || typeof roomCode !== 'string' || !name || typeof name !== 'string') {
        return ack({ error: "Room code and name are required." });
      }

      const trimmedName = name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 25) {
        return ack({ error: "Name must be between 1 and 25 characters." });
      }

      const room = getRoomByCode(roomCode);
      if (!room) return ack({ error: "Room not found. Check the code." });

      // Check duplicate name in room (case-insensitive)
      const existingName = db.prepare(
        "SELECT id FROM participants WHERE room_id = ? AND LOWER(name) = LOWER(?)"
      ).get(room.id, trimmedName);
      if (existingName) {
        return ack({ error: "Name already taken in this room." });
      }

      // Can only join if room is in WAITING state
      if (room.status !== "WAITING") {
        return ack({ error: "This quiz has already started." });
      }

      // Cryptographically secure participant token
      const token = generateToken();
      const result = db
        .prepare("INSERT INTO participants (room_id, token, name) VALUES (?, ?, ?)")
        .run(room.id, token, trimmedName);

      socket.join(roomCode);
      socket.data.participantId = result.lastInsertRowid;
      socket.data.roomCode = roomCode;

      const participantCount = db
        .prepare("SELECT COUNT(*) as count FROM participants WHERE room_id = ? AND connected = 1")
        .get(room.id).count;

      io.to(roomCode).emit("lobby:update", { participantCount });

      ack({ token, participantId: result.lastInsertRowid });
    });

    socket.on("player:rejoin", ({ roomCode, token }, ack) => {
      if (typeof ack !== 'function') ack = () => {};
      if (!token || typeof token !== 'string') return ack({ error: "Token required." });

      const participant = db.prepare("SELECT * FROM participants WHERE token = ?").get(token);
      if (!participant) return ack({ error: "Session not found." });

      const room = getRoomByCode(roomCode);
      if (!room || room.id !== participant.room_id) {
        return ack({ error: "Room mismatch or room does not exist." });
      }

      db.prepare("UPDATE participants SET connected = 1 WHERE id = ?").run(participant.id);
      socket.join(roomCode);
      socket.data.participantId = participant.id;
      socket.data.roomCode = roomCode;

      const state = activeRooms.get(roomCode);

      ack({
        ok: true,
        name: participant.name,
        score: participant.score,
        eliminated: participant.eliminated === 1,
        roomStatus: room.status,
        currentQuestion: state?.currentQuestion || null,
      });
    });

    socket.on("player:submitAnswer", ({ roomCode, questionId, selectedOption }, ack) => {
      if (typeof ack !== 'function') ack = () => {};

      const participantId = socket.data.participantId;
      if (!participantId) {
        return ack({ error: "Unauthorized: You have not joined this quiz." });
      }

      if (!['A', 'B', 'C', 'D'].includes(selectedOption)) {
        return ack({ error: "Invalid option selected." });
      }

      const room = getRoomByCode(roomCode);
      const state = activeRooms.get(roomCode);

      // Strict Validation of Game State
      if (!room || room.status !== 'QUESTION_ACTIVE') {
        return ack({ error: "Answers are not currently being accepted." });
      }
      if (!state || !state.currentQuestion || state.currentQuestion.id !== questionId) {
        return ack({ error: "This question is no longer active." });
      }
      if (Date.now() > state.currentQuestion.deadline + 300) {
        return ack({ error: "Time's up." });
      }

      const participant = db.prepare("SELECT streak, eliminated, room_id FROM participants WHERE id = ?").get(participantId);
      if (!participant || participant.room_id !== room.id) {
        return ack({ error: "Participant data invalid." });
      }
      if (participant.eliminated) {
        return ack({ error: "You have been eliminated from this Survival game!" });
      }

      // Concurrency check: prevent duplicate answers
      const alreadyAnswered = db
        .prepare("SELECT id FROM answers WHERE question_id = ? AND participant_id = ?")
        .get(questionId, participantId);
      if (alreadyAnswered) {
        return ack({ error: "You already answered this question." });
      }

      const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId);
      if (!question || question.room_id !== room.id) {
        return ack({ error: "Invalid question." });
      }

      const responseTimeMs = Math.max(0, Date.now() - state.currentQuestion.startTime);
      const isCorrect = selectedOption === question.correct_option;

      let points = 0;
      let currentStreak = participant.streak || 0;
      let newlyEliminated = 0;

      if (isCorrect) {
        currentStreak += 1;
        const timeLimitMs = state.currentQuestion.timeLimitSeconds * 1000;
        const remainingRatio = Math.max(0, (timeLimitMs - responseTimeMs) / timeLimitMs);

        // Streak multiplier: 1.0x to 1.5x
        const multiplier = 1 + (Math.min(currentStreak, 5) * 0.1);
        const basePoints = Math.round(500 + 500 * remainingRatio);
        points = Math.round(basePoints * multiplier);
      } else {
        currentStreak = 0; // Reset streak on wrong answer
        if (room.mode === 'Survival') {
          newlyEliminated = 1;
        }
      }

      // Atomic persistence of answer and score
      db.transaction(() => {
        db.prepare(`
          INSERT INTO answers (room_id, question_id, participant_id, selected_option, is_correct, response_time_ms, points_awarded)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(room.id, questionId, participantId, selectedOption, isCorrect ? 1 : 0, responseTimeMs, points);

        db.prepare(
          "UPDATE participants SET score = score + ?, streak = ?, eliminated = ? WHERE id = ?"
        ).run(points, currentStreak, newlyEliminated, participantId);
      })();

      if (selectedOption in state.optionCounts) {
        state.optionCounts[selectedOption]++;
      }

      // Calculate Real-Time Host Analytics
      const totalAnswersSoFar = state.optionCounts.A + state.optionCounts.B + state.optionCounts.C + state.optionCounts.D;
      const correctCount = state.optionCounts[question.correct_option] || 0;
      const globalAccuracy = totalAnswersSoFar > 0 ? Math.round((correctCount / totalAnswersSoFar) * 100) : 0;

      io.to(roomCode).emit("results:tally", {
        optionCounts: state.optionCounts,
        globalAccuracy
      });

      ack({ ok: true, isCorrect, points, streak: currentStreak, eliminated: newlyEliminated === 1 });
    });

    socket.on("disconnect", () => {
      if (socket.data.participantId) {
        db.prepare("UPDATE participants SET connected = 0 WHERE id = ?").run(socket.data.participantId);
        if (socket.data.roomCode) {
          const room = getRoomByCode(socket.data.roomCode);
          if (room && room.status === 'WAITING') {
            const participantCount = db
              .prepare("SELECT COUNT(*) as count FROM participants WHERE room_id = ? AND connected = 1")
              .get(room.id).count;
            io.to(socket.data.roomCode).emit("lobby:update", { participantCount });
          }
        }
      }
    });
  });
}

module.exports = setupSocketIO;
