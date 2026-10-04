# Sparq: Real-Time AI Quiz Platform

## 📌 Project Overview
Sparq is a full-stack, real-time multiplayer trivia platform built with **React**, **Node.js**, **Express**, **Socket.io**, and **SQLite**. It features an AI-powered question generator (using Groq API), allowing hosts to instantly create, save, and host live trivia games for dozens of participants with zero latency. 

## ✨ Key Features
- **Real-Time WebSockets:** Powered by `Socket.io` for instant lobby joining, question broadcasting, answer submissions, and live leaderboard updates.
- **AI Question Generator:** Integrates with Groq's API (`openai/gpt-oss-120b`) to instantly generate topic-based trivia questions with randomized choices.
- **Custom JWT Authentication:** Hosts can register accounts, login via JSON Web Tokens, and save generated quizzes to a persistent personal Quiz Bank.
- **SQLite Database:** Uses `better-sqlite3` with WAL (Write-Ahead Logging) for lightning-fast synchronous reads/writes of rooms, questions, users, and saved quizzes.
- **Immersive UI & Web Audio:** Uses a premium Glassmorphism Dark Mode design with CSS animations. Employs the native browser `Web Audio API` to synthesize real-time sound effects (chimes, ticks) without needing external audio files.

---

## 🏗️ Architecture & Folder Structure
This project is a Monorepo containing a separated frontend and backend.

```
c:\quiz-app\
├── backend/
│   ├── server.js                 # Entry point, Express setup, Socket.io initialization
│   ├── .env                      # Environment variables (PORT, GROQ_API_KEY, JWT_SECRET)
│   ├── src/
│   │   ├── db/database.js        # SQLite connection, schemas, and migrations
│   │   ├── controllers/          # Express route logic (authController, quizController)
│   │   ├── middleware/           # Custom JWT auth middleware
│   │   ├── routes/               # Express API routes (/api/auth, /api/quiz)
│   │   └── socket/               # Socket.io event handlers (rooms, answers, timers)
│
├── frontend/
│   ├── index.html                # Vite HTML entry
│   ├── package.json              # React dependencies (lucide-react, react-router-dom)
│   ├── src/
│   │   ├── App.jsx               # React Router definitions & Global UI Header
│   │   ├── AuthContext.jsx       # Global React Context for JWT Session State
│   │   ├── index.css             # Premium Glassmorphism UI & CSS Variables
│   │   ├── socket.js             # Singleton Socket.io client instance
│   │   ├── utils/sounds.js       # Web Audio API synthesizer for sound effects
│   │   └── pages/                
│   │       ├── Home.jsx          # Landing page (Host vs Join)
│   │       ├── Login.jsx         # Custom JWT Registration/Login interface
│   │       ├── HostCreate.jsx    # Quiz Builder, AI Generator, Quiz Bank UI
│   │       ├── HostRoom.jsx      # Live Host Dashboard (QR Code, Live Leaderboard)
│   │       ├── PlayerJoin.jsx    # Participant entry portal (Room Code + Name)
│   │       └── PlayerRoom.jsx    # Live Participant interface (Mobile-optimized)
```

---

## 🚀 Deployment Strategy (Portfolio Optimized)

Because Vercel is a "Serverless" environment (where functions sleep after every request), it **cannot** host real-time WebSocket backends or local SQLite files. Therefore, this project uses a multi-cloud split deployment strategy:

1. **Frontend (Vercel):** The React `dist` folder is deployed to Vercel for lightning-fast edge CDN delivery.
2. **Backend (Render):** The Node.js + SQLite backend is deployed to Render's free tier as a persistent Web Service, utilizing a persistent disk mount for the `quiz.db` file.
3. **Keep-Alive Strategy:** To prevent the Render backend from sleeping (which causes a 45-second cold start), a tool like UptimeRobot is used to ping the `/health` endpoint every 10 minutes.

---

## 🧠 Technical Interview Talking Points

If discussing this project in a technical interview, emphasize these engineering decisions:

1. **Why SQLite + WAL?**
   "I chose SQLite with Write-Ahead Logging (WAL) because trivia games are extremely read-heavy during the actual game, but write-heavy at the exact second a question ends. WAL allows concurrent reads and writes, making it perfectly suited for a single-node Node.js deployment."
2. **Why WebSockets over HTTP Polling?**
   "For a live quiz, latency ruins the experience. I used Socket.io to maintain a persistent TCP connection. This allows the host to broadcast the exact millisecond a question starts, and allows the server to instantly stream live 'Option A vs Option B' tally bars back to the host dashboard without spamming the server with HTTP requests."
3. **How did you handle Mobile Browser Audio Policies?**
   "Mobile Safari and Chrome strictly block audio playback until a user interacts with the screen. Because players just sit and wait for the host to start the game, the Web Audio API was blocked. I solved this by adding an invisible global event listener that silently unlocks the \`AudioContext\` on the very first touch event (like scrolling or tapping the screen)."
4. **How did you secure the API?**
   "I built a custom JWT (JSON Web Token) authentication flow from scratch. Passwords are mathematically hashed using \`bcryptjs\` before entering the SQLite database. The Express backend uses custom middleware to verify the Bearer token before allowing users to save or load from their private Quiz Bank."

---

## 💻 Local Development Setup

To run this project locally on your machine:

1. **Clone & Install:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Backend Setup:**
   Create a `backend/.env` file:
   ```env
   PORT=4000
   GROQ_API_KEY=your_groq_api_key_here
   JWT_SECRET=super_secret_dev_key
   ```
   Start the backend: `npm start` (Runs on http://localhost:4000)

3. **Frontend Setup:**
   Create a `frontend/.env` file:
   ```env
   VITE_SERVER_URL=http://localhost:4000
   ```
   Start the frontend: `npm run dev` (Runs on http://localhost:5173)
