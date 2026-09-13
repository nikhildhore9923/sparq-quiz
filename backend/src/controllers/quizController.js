const { db, generateRoomCode } = require('../db/database');
const { z } = require('zod');

// Validation schema for creating a quiz
const createQuizSchema = z.object({
  hostName: z.string().min(1, "Host name is required"),
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
    const { hostName, questions } = validatedData;
    
    const code = generateRoomCode();
    
    // We use a transaction to ensure both room and questions are saved together
    const insertQuiz = db.transaction(() => {
      const roomInsert = db.prepare("INSERT INTO rooms (code, host_name, status) VALUES (?, ?, 'WAITING')").run(code, hostName);
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
