const { db, generateToken } = require('../db/database');

const activeRooms = new Map();
// State Machine Statuses: WAITING, STARTING, QUESTION_ACTIVE, QUESTION_ENDED, FINISHED

function getRoomByCode(code) {
  return db.prepare("SELECT * FROM rooms WHERE code = ?").get(code);
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
    const questions = getQuestionsForRoom(room.id);
    const question = questions[room.current_question_index];

    const timeLimitMs = question.time_limit_seconds * 1000;
    const startTime = Date.now();
    const deadline = startTime + timeLimitMs;

    db.prepare("UPDATE rooms SET status = 'QUESTION_ACTIVE' WHERE id = ?").run(room.id);

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
      deadline,
      questionNumber: room.current_question_index + 1,
      totalQuestions: questions.length,
    });

    const timerHandle = setTimeout(() => endQuestion(roomCode), timeLimitMs + 300);
    activeRooms.get(roomCode).questionTimer = timerHandle;
  }

  function endQuestion(roomCode) {
    const state = activeRooms.get(roomCode);
    if (!state || !state.currentQuestion) return;
    clearTimeout(state.questionTimer);

    const room = getRoomByCode(roomCode);
    
    // Strict state transition
    if (room.status !== 'QUESTION_ACTIVE') return;
    
    db.prepare("UPDATE rooms SET status = 'QUESTION_ENDED' WHERE id = ?").run(room.id);

    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(state.currentQuestion.id);
    const answers = db.prepare("SELECT a.*, p.name FROM answers a JOIN participants p ON a.participant_id = p.id WHERE a.question_id = ?").all(state.currentQuestion.id);
    
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
      correctOption: question.correct_option,
      optionCounts: state.optionCounts,
      totalAnswered,
      fastestResponder
    });

    io.to(roomCode).emit("leaderboard:update", { leaderboard: getLeaderboard(room.id) });

    activeRooms.set(roomCode, { ...state, currentQuestion: null });
  }

  function finalizeQuiz(roomCode) {
    const room = getRoomByCode(roomCode);
    db.prepare("UPDATE rooms SET status = 'FINISHED' WHERE id = ?").run(room.id);

    const questions = getQuestionsForRoom(room.id);
    const perQuestionStats = questions.map((q) => {
      const answers = db.prepare("SELECT * FROM answers WHERE question_id = ?").all(q.id);
      const correctCount = answers.filter((a) => a.is_correct).length;
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

  io.on("connection", (socket) => {
    
    // ---------------- HOST EVENTS ----------------
    socket.on("host:joinRoom", ({ roomCode }, ack) => {
      const room = getRoomByCode(roomCode);
      if (!room) return ack({ error: "Room not found" });
      
      socket.join(roomCode);
      
      // Initialize active room state if not exists
      if (!activeRooms.has(roomCode)) {
        activeRooms.set(roomCode, { hostSocketId: socket.id, currentQuestion: null, optionCounts: {} });
      } else {
        const state = activeRooms.get(roomCode);
        activeRooms.set(roomCode, { ...state, hostSocketId: socket.id });
      }
      
      ack({ ok: true, status: room.status });
    });

    socket.on("host:startQuiz", ({ roomCode }) => {
      const room = getRoomByCode(roomCode);
      if (!room || room.status !== 'WAITING') return; // Strict transition

      db.prepare("UPDATE rooms SET status = 'STARTING', current_question_index = 0 WHERE id = ?").run(room.id);
      io.to(roomCode).emit("quiz:started");
      
      // Short delay before first question
      setTimeout(() => broadcastQuestion(roomCode), 2000);
    });

    socket.on("host:nextQuestion", ({ roomCode }) => {
      const room = getRoomByCode(roomCode);
      if (!room || room.status !== 'QUESTION_ENDED') return; // Strict transition

      const questions = getQuestionsForRoom(room.id);
      const nextIndex = room.current_question_index + 1;

      if (nextIndex >= questions.length) {
        finalizeQuiz(roomCode);
        return;
      }

      db.prepare("UPDATE rooms SET current_question_index = ? WHERE id = ?").run(nextIndex, room.id);
      broadcastQuestion(roomCode);
    });

    // ---------------- PARTICIPANT EVENTS ----------------
    socket.on("player:join", ({ roomCode, name }, ack) => {
      const room = getRoomByCode(roomCode);
      if (!room) return ack({ error: "Room not found. Check the code." });
      
      // Check duplicate name
      const existingName = db.prepare("SELECT id FROM participants WHERE room_id = ? AND name = ?").get(room.id, name);
      if (existingName) {
        return ack({ error: "Name already taken in this room." });
      }

      // Can only join fresh if WAITING
      if (room.status !== "WAITING") return ack({ error: "This quiz has already started." });

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
      const room = getRoomByCode(roomCode);

      // Strict Validation
      if (!room || room.status !== 'QUESTION_ACTIVE') {
        return ack({ error: "Answers are not currently being accepted." });
      }
      if (!state || !state.currentQuestion || state.currentQuestion.id !== questionId) {
        return ack({ error: "This question is no longer active." });
      }
      if (Date.now() > state.currentQuestion.deadline + 300) {
        return ack({ error: "Time's up." });
      }

      const alreadyAnswered = db
        .prepare("SELECT id FROM answers WHERE question_id = ? AND participant_id = ?")
        .get(questionId, participantId);
      if (alreadyAnswered) return ack({ error: "You already answered this question." });

      const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId);
      const participant = db.prepare("SELECT streak FROM participants WHERE id = ?").get(participantId);
      
      const responseTimeMs = Date.now() - state.currentQuestion.startTime;
      const isCorrect = selectedOption === question.correct_option;

      let points = 0;
      let currentStreak = participant.streak || 0;

      if (isCorrect) {
        currentStreak += 1;
        const timeLimitMs = state.currentQuestion.timeLimitSeconds * 1000;
        const remainingRatio = Math.max(0, (timeLimitMs - responseTimeMs) / timeLimitMs);
        
        // Streak multiplier: 1.0x, 1.2x, 1.5x, etc.
        const multiplier = 1 + (Math.min(currentStreak, 5) * 0.1); 
        const basePoints = Math.round(500 + 500 * remainingRatio);
        points = Math.round(basePoints * multiplier);
      } else {
        currentStreak = 0; // Reset streak on wrong answer
      }

      db.prepare(`
        INSERT INTO answers (room_id, question_id, participant_id, selected_option, is_correct, response_time_ms, points_awarded)
        VALUES ((SELECT room_id FROM questions WHERE id = ?), ?, ?, ?, ?, ?, ?)
      `).run(questionId, questionId, participantId, selectedOption, isCorrect ? 1 : 0, responseTimeMs, points);

      db.prepare("UPDATE participants SET score = score + ?, streak = ? WHERE id = ?").run(points, currentStreak, participantId);

      if (selectedOption in state.optionCounts) state.optionCounts[selectedOption]++;

      io.to(roomCode).emit("results:tally", { optionCounts: state.optionCounts });

      ack({ ok: true, isCorrect, points, streak: currentStreak });
    });

    socket.on("disconnect", () => {
      if (socket.data.participantId) {
        db.prepare("UPDATE participants SET connected = 0 WHERE id = ?").run(socket.data.participantId);
        if (socket.data.roomCode) {
          const room = getRoomByCode(socket.data.roomCode);
          if (room && room.status === 'WAITING') {
            const participantCount = db
              .prepare("SELECT COUNT(*) as count FROM participants WHERE room_id = ?")
              .get(room.id).count;
            io.to(socket.data.roomCode).emit("lobby:update", { participantCount });
          }
        }
      }
    });
  });
}

module.exports = setupSocketIO;
