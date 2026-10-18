const { db, generateRoomCode, generateToken } = require('../db/database');
const { z } = require('zod');

// Validation schema for creating a live quiz room
const createQuizSchema = z.object({
  hostName: z.string().trim().min(1, "Host name is required").max(50, "Host name too long"),
  mode: z.enum(['Classic', 'Rapid Fire', 'Survival']).default('Classic'),
  questions: z.array(
    z.object({
      questionText: z.string().trim().min(1, "Question text is required").max(500, "Question text too long"),
      options: z.array(z.string().trim().min(1, "Option text required").max(200, "Option too long")).length(4, "Must provide exactly 4 options"),
      correctOption: z.enum(['A', 'B', 'C', 'D']),
      timeLimit: z.coerce.number().int().min(5).max(120).default(20),
    })
  ).min(1, "At least one question is required").max(100, "Maximum 100 questions per quiz")
});

// Validation schema for saving to private Quiz Bank
const saveToBankSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title must be 100 characters or fewer"),
  questions: z.array(
    z.object({
      questionText: z.string().trim().min(1, "Question text is required").max(500),
      options: z.array(z.string().trim().min(1, "Option text required").max(200)).length(4),
      correctOption: z.enum(['A', 'B', 'C', 'D']),
      timeLimit: z.coerce.number().int().min(5).max(120).default(20),
    })
  ).min(1, "At least one question is required").max(100)
});

// Validation schema for AI generation
const generateQuestionsSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required").max(100, "Topic must be 100 characters or fewer"),
  numQuestions: z.coerce.number().int().min(1, "Minimum 1 question").max(50, "Maximum 50 questions per AI request").default(5),
  globalTimeLimit: z.coerce.number().int().min(5).max(120).default(20),
});

exports.createQuiz = (req, res) => {
  try {
    const validatedData = createQuizSchema.parse(req.body);
    const { hostName, mode, questions } = validatedData;

    const code = generateRoomCode();
    const hostToken = generateToken();

    // We use a transaction to ensure both room and questions are saved atomically
    const insertQuiz = db.transaction(() => {
      const roomInsert = db.prepare(
        "INSERT INTO rooms (code, host_name, mode, status, host_token) VALUES (?, ?, ?, 'WAITING', ?)"
      ).run(code, hostName, mode, hostToken);
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
          q.timeLimit,
          i
        );
      });

      return { code, hostToken };
    });

    const result = insertQuiz();
    res.status(201).json({ success: true, roomCode: result.code, hostToken: result.hostToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      const firstMsg = issues[0]?.message || "Invalid input";
      return res.status(400).json({ success: false, error: firstMsg, errors: issues });
    }
    console.error("Error creating quiz:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getQuizStatus = (req, res) => {
  const { roomCode } = req.params;
  if (!roomCode || typeof roomCode !== 'string') {
    return res.status(400).json({ success: false, error: "Invalid room code" });
  }

  const room = db.prepare("SELECT code, host_name, mode, status, current_question_index FROM rooms WHERE code = ?").get(roomCode.trim().toUpperCase());

  if (!room) {
    return res.status(404).json({ success: false, error: "Room not found" });
  }

  res.json({ success: true, status: room.status, hostName: room.host_name, mode: room.mode });
};

exports.generateQuestions = async (req, res) => {
  const parseResult = generateQuestionsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const msg = (parseResult.error.issues || parseResult.error.errors || [])[0]?.message || "Validation error";
    return res.status(400).json({ success: false, error: msg });
  }

  const { topic, numQuestions, globalTimeLimit } = parseResult.data;
  const apiKey = process.env.GROQ_API_KEY;

  const shuffleOptions = (options, correctOptionStr) => {
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctOptionStr);
    const validCorrectIndex = correctIndex >= 0 ? correctIndex : 0;

    // Map with correctness flag
    let mapped = options.map((opt, i) => ({ text: opt, isCorrect: i === validCorrectIndex }));

    // Fisher-Yates shuffle
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
    }

    const newCorrectIndex = mapped.findIndex(m => m.isCorrect);
    return {
      options: mapped.map(m => m.text),
      correctOption: ['A', 'B', 'C', 'D'][newCorrectIndex >= 0 ? newCorrectIndex : 0]
    };
  };

  if (apiKey) {
    try {
      // Sanitize topic string for safe inclusion in prompt
      const cleanTopic = topic.replace(/[^\w\s.,?!-]/gi, '').slice(0, 80);
      const prompt = `Generate exactly ${numQuestions} multiple choice trivia questions about "${cleanTopic}".
Output ONLY valid JSON. The JSON must be an object containing a single key "questions" which is an array of objects.
Each object in the array must have exactly these keys:
- questionText (string, the trivia question)
- options (array of exactly 4 strings, the possible answers)
- correctOption (string, exactly "A", "B", "C", or "D")
- timeLimit (number, exactly ${globalTimeLimit})`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Groq API returned an error");

      const jsonString = data.choices?.[0]?.message?.content;
      if (!jsonString) throw new Error("Empty response from AI model");

      const result = JSON.parse(jsonString);
      if (!Array.isArray(result.questions)) throw new Error("AI did not return a questions array");

      const shuffledQuestions = result.questions.map(q => {
        const rawOptions = Array.isArray(q.options) && q.options.length === 4
          ? q.options.map(String)
          : ["Option A", "Option B", "Option C", "Option D"];
        const rawCorrect = ['A', 'B', 'C', 'D'].includes(q.correctOption) ? q.correctOption : 'A';
        const shuffled = shuffleOptions(rawOptions, rawCorrect);

        return {
          questionText: String(q.questionText || "Question"),
          options: shuffled.options,
          correctOption: shuffled.correctOption,
          timeLimit: globalTimeLimit
        };
      });

      return res.json({ success: true, questions: shuffledQuestions });
    } catch (error) {
      console.error("Groq AI Service Notice:", error.message);
      // Fallback gracefully below
    }
  }

  // Graceful Mock Fallback (when API key is missing or service rate-limits)
  const mockQuestions = Array.from({ length: numQuestions }).map((_, i) => {
    const shuffled = shuffleOptions([
      `Core Concept ${i + 1} (Correct)`,
      `Alternative Concept B`,
      `Common Misconception C`,
      `Plausible Distractor D`
    ], "A");
    return {
      questionText: `Key question ${i + 1} regarding ${topic}?`,
      options: shuffled.options,
      correctOption: shuffled.correctOption,
      timeLimit: globalTimeLimit
    };
  });

  return res.json({ success: true, questions: mockQuestions, fallbackUsed: true });
};

exports.saveToBank = (req, res) => {
  try {
    const parseResult = saveToBankSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = (parseResult.error.issues || parseResult.error.errors || [])[0]?.message || "Validation error";
      return res.status(400).json({ success: false, error: msg });
    }

    const { title, questions } = parseResult.data;
    const userId = req.user.id;

    const saveQuiz = db.transaction(() => {
      const quizInsert = db.prepare("INSERT INTO saved_quizzes (title, user_id) VALUES (?, ?)").run(title, userId);
      const quizId = quizInsert.lastInsertRowid;

      const insertQuestion = db.prepare(`
        INSERT INTO saved_questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      questions.forEach(q => {
        insertQuestion.run(
          quizId, q.questionText, q.options[0], q.options[1], q.options[2], q.options[3], q.correctOption, q.timeLimit || 20
        );
      });
      return quizId;
    });

    const quizId = saveQuiz();
    res.json({ success: true, quizId });
  } catch (error) {
    console.error("Error saving to bank:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.loadFromBank = (req, res) => {
  try {
    const userId = req.user.id;
    // Strictly isolate data to the authenticated user's ID
    const quizzes = db.prepare(
      "SELECT id, title, created_at FROM saved_quizzes WHERE user_id = ? ORDER BY created_at DESC"
    ).all(userId);

    const formattedQuizzes = quizzes.map(q => {
      const questions = db.prepare(
        "SELECT question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds FROM saved_questions WHERE quiz_id = ? ORDER BY id ASC"
      ).all(q.id);
      return {
        id: q.id,
        title: q.title,
        questions: questions.map(sq => ({
          questionText: sq.question_text,
          options: [sq.option_a, sq.option_b, sq.option_c, sq.option_d],
          correctOption: sq.correct_option,
          timeLimit: sq.time_limit_seconds
        }))
      };
    });

    res.json({ success: true, quizzes: formattedQuizzes });
  } catch (error) {
    console.error("Error loading from bank:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getGlobalLeaderboard = (req, res) => {
  try {
    const topParticipants = db.prepare(
      "SELECT name, score FROM participants ORDER BY score DESC, joined_at ASC LIMIT 10"
    ).all();
    res.json({ success: true, leaderboard: topParticipants });
  } catch (error) {
    console.error("Leaderboard Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
};
