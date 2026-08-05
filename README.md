# Sparq — Live Quiz Platform

A real-time, Kahoot-style quiz app. Host creates a multi-question quiz, participants
join from their phones with a room code, and everyone sees questions, live results,
and a leaderboard update instantly via WebSockets - no page refresh, ever.

## How it's different from a basic CRUD project
- **Real-time, not request/response.** Built on Socket.io (WebSockets), not REST -
  the server pushes updates to every connected client the instant something happens.
- **Server-authoritative timing.** The question countdown deadline is set and enforced
  by the server, not trusted from any client's clock - this is what makes speed-based
  scoring fair and cheat-resistant.
- **Speed-based scoring.** Correct answers score 500-1000 points depending on how much
  time was left when you answered - real logic, not just "correct = 1 point."
- **Reconnection handling.** If a participant's phone drops connection mid-quiz (very
  common on mobile data), they can rejoin with their score intact using a saved token.
- **Persisted analytics.** Every quiz's results (per-question accuracy, average response
  time, final rankings) are saved to a real SQL database, not just held in memory.

## Folder structure
```
quiz-app/
├── backend/
│   ├── server.js       - Express + Socket.io server, all real-time logic
│   ├── db.js            - SQLite schema + database helpers
│   ├── test_e2e.js       - automated test simulating a full quiz (host + 2 players)
│   └── package.json
└── frontend/
    └── src/
        ├── socket.js      - Socket.io client connection
        ├── App.jsx         - routes
        └── pages/
            ├── Home.jsx        - choose Host or Join
            ├── HostCreate.jsx   - build a quiz
            ├── HostRoom.jsx      - live control panel
            ├── PlayerJoin.jsx    - enter room code + name
            └── PlayerRoom.jsx    - answer questions live
```

## Setup - 2 terminals

### Terminal 1: Backend
```
cd backend
npm install
npm start
```
Should print: `Quiz server running on http://localhost:4000`

### Terminal 2: Frontend
```
cd frontend
npm install
npm run dev
```
Open the URL it gives you (usually http://localhost:5173).

## How to actually test it (needs 2+ browser windows/devices)
1. Open the app in one browser tab, click **Host a Quiz**, add 2-3 questions, click Create Room.
2. You'll get a 6-character room code.
3. Open the app in a **different browser tab or your phone** (see note below), click
   **Join a Quiz**, enter the code and a name.
4. Back on the host tab, click **Start Quiz** once at least one player has joined.
5. Answer on the player tab before the timer runs out, watch the host tab's live bar chart update.
6. Click **Next Question** on the host to continue, or let the quiz finish to see final analytics.

## Testing from your actual phone (same WiFi)
`vite.config.js` is already set to `host: true`, which allows other devices on your
WiFi to reach the dev server. Find your computer's local IP (e.g. `192.168.1.5`,
run `ipconfig` on Windows and look for IPv4 Address), then on your phone visit:
```
http://192.168.1.5:5173
```
You'll also need to update `frontend/.env` (copy from `.env.example`) so the phone's
browser can reach your backend:
```
VITE_SERVER_URL=http://192.168.1.5:4000
```

## Running the automated test
This simulates a full quiz (host + 2 players, real answers, reconnection, timeout)
without needing any browser at all - useful for confirming nothing broke after a change.
```
cd backend
npm install socket.io-client   # test-only dependency, not needed for the app itself
node server.js                  # in one terminal
node test_e2e.js                # in another - should print "20 passed, 0 failed"
```
