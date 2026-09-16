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

exports.generateQuestions = (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ success: false, error: "Topic is required" });

  // Mock AI Generation - in a real app this would call OpenAI/Anthropic
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

  // Simulate network delay
  setTimeout(() => {
    res.json({ success: true, questions: mockQuestions });
  }, 1500);
};
