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
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: "Topic is required" });

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `Generate exactly 5 multiple choice trivia questions about "${topic}".
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

  // Mock Fallback (used if no API key or if API fails)
  const mockQuestions = [
    {
      questionText: `What is the core concept of ${topic}?`,
      options: ["The beginning", "The middle", "The end", "The core itself"],
      correctOption: "D",
      timeLimit: 20
    },
    {
      questionText: `Who invented ${topic}?`,
      options: ["Albert Einstein", "Marie Curie", "John Doe", "Jane Smith"],
      correctOption: "C",
      timeLimit: 20
    },
    {
      questionText: `Why is ${topic} important?`,
      options: ["It saves time", "It is fun", "It is complex", "All of the above"],
      correctOption: "A",
      timeLimit: 20
    },
    {
      questionText: `Which of these is NOT related to ${topic}?`,
      options: ["Apples", "Oranges", "Bananas", "Grapes"],
      correctOption: "B",
      timeLimit: 20
    },
    {
      questionText: `When was ${topic} first discovered?`,
      options: ["1990", "2000", "2010", "2020"],
      correctOption: "B",
      timeLimit: 20
    }
  ];

  setTimeout(() => {
    res.json({ success: true, questions: mockQuestions });
  }, 1000);
};
