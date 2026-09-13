const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const quizRoutes = require("./src/routes/quizRoutes");
const setupSocketIO = require("./src/sockets/socketManager");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 4000;

// Routes
app.get("/health", (req, res) => res.json({ status: "Quiz server is running cleanly" }));
app.use("/api/quiz", quizRoutes);

// Socket.io initialization
setupSocketIO(io);

server.listen(PORT, () => {
  console.log(`Quiz server running on http://localhost:${PORT}`);
});
