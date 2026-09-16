const { db, generateRoomCode } = require('../db/database');
const { z } = require('zod');

// Validation schema for creating a quiz
const createQuizSchema = z.object({
  hostName: z.string().min(1, "Host name is required"),
  mode: z.enum(['Classic', 'Rapid Fire', 'Survival']).default('Classic'),
  questions: z.array(
    z.object({
      questionText: z.string().min(1, "Question text is required"),
      options: z.array(z.string()).length(4, "Must provide exactly 4 options"),
      correctOption: z.enum(['A', 'B', 'C', 'D']),
      timeLimit: z.number().min(5).max(120).default(20),
    })
  ).min(1, "At least one question is required")
});

exports.createQuiz = (req, res) => {
  try {
    const validatedData = createQuizSchema.parse(req.body);
    const { hostName, mode, questions } = validatedData;
    
    const code = generateRoomCode();
    
    // We use a transaction to ensure both room and questions are saved together
    const insertQuiz = db.transaction(() => {
      const roomInsert = db.prepare("INSERT INTO rooms (code, host_name, mode, status) VALUES (?, ?, ?, 'WAITING')").run(code, hostName, mode);
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
      
      return code;
    });

    const roomCode = insertQuiz();
    res.status(201).json({ success: true, roomCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    console.error("Error creating quiz:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getQuizStatus = (req, res) => {
  const { roomCode } = req.params;
  const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(roomCode);
  
  if (!room) {
    return res.status(404).json({ success: false, error: "Room not found" });
  }
  
  res.json({ success: true, status: room.status, hostName: room.host_name });
};

exports.generateQuestions = async (req, res) => {
  const { topic, numQuestions = 5 } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: "Topic is required" });
  
  const count = Math.min(Math.max(parseInt(numQuestions) || 5, 1), 20);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `Generate exactly ${count} multiple choice trivia questions about "${topic}".
Return ONLY a valid JSON array of objects. Do not include markdown formatting, backticks, or any other text.
Each object in the array must have exactly these keys:
- questionText (string, the trivia question)
- options (array of exactly 4 strings, the possible answers)
- correctOption (string, exactly "A", "B", "C", or "D")
- timeLimit (number, exactly 20)`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");

      const text = data.candidates[0].content.parts[0].text;
      const questions = JSON.parse(text);
      
      return res.json({ success: true, questions });
    } catch (error) {
      console.error("Gemini API Error:", error);
      // Fall through to mock if it fails
      console.log("Falling back to mock questions...");
    }
  }

  // Mock Fallback
  const mockQuestions = Array.from({ length: count }).map((_, i) => ({
    questionText: `Mock Question ${i + 1} about ${topic}?`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctOption: "A",
    timeLimit: 20
  }));

  setTimeout(() => {
    res.json({ success: true, questions: mockQuestions });
  }, 1000);
};

exports.saveToBank = (req, res) => {
  try {
    const { title, questions } = req.body;
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ success: false, error: "Title and questions are required" });
    }

    const saveQuiz = db.transaction(() => {
      const quizInsert = db.prepare("INSERT INTO saved_quizzes (title) VALUES (?)").run(title);
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
    console.error("Error saving to bank:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.loadFromBank = (req, res) => {
  try {
    const quizzes = db.prepare("SELECT id, title, created_at FROM saved_quizzes ORDER BY created_at DESC").all();
    
    const formattedQuizzes = quizzes.map(q => {
      const questions = db.prepare("SELECT * FROM saved_questions WHERE quiz_id = ?").all(q.id);
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
    console.error("Error loading from bank:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
