require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const quizRoutes = require("./src/routes/quizRoutes");
const setupSocketIO = require("./src/sockets/socketManager");

const app = express();
app.set("trust proxy", 1); // Trust reverse proxy on Render/Vercel for accurate client IP rate limiting

// Allowed Origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://sparq-quiz.vercel.app",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

if (process.env.ALLOWED_ORIGINS) {
  const extra = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, ""));
  allowedOrigins.push(...extra);
}

function isOriginAllowed(origin) {
  if (!origin) return true; // Allow non-browser agents, health checks, curl, server-to-server
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: origin not allowed"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "500kb" }));

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // 25 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication requests from this IP. Please try again after 15 minutes." }
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12, // 12 AI question generations per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "AI generation rate limit exceeded. Please wait a minute before trying again." }
});

const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 rooms created per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Room creation limit reached. Please wait a few minutes." }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;

// Routes
app.get("/health", (req, res) => res.json({ status: "Quiz server is running cleanly", timestamp: new Date().toISOString() }));
app.use("/api/auth", authLimiter, require("./src/routes/authRoutes"));
app.use("/api/quiz/generate", generateLimiter);
app.use("/api/quiz/create", createRoomLimiter);
app.use("/api/quiz", quizRoutes);

// Global error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ error: "Access denied by CORS policy" });
  }
  console.error("Unhandled express error:", err.message);
  res.status(500).json({ error: "An unexpected server error occurred" });
});

// Socket.io initialization
setupSocketIO(io);

server.listen(PORT, () => {
  console.log(`Quiz server running on http://localhost:${PORT}`);
});
