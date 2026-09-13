# Sparq — Interview Preparation Guide

This document is designed to help you confidently discuss and defend your Sparq project in any technical interview.

---

## 1. 60–90 Second Elevator Pitch
*"Sparq is a real-time multiplayer quiz platform I built as a modern, high-performance alternative to Kahoot. The core challenge was handling highly concurrent game states where multiple players are submitting answers at the exact same millisecond. I built the backend using Node.js and Express, implementing a strict server-authoritative state machine to prevent race conditions and ensure fair scoring. I specifically separated concerns by using REST APIs for persistent actions like quiz creation, and Socket.io strictly for high-speed transient gameplay data. It features a time-decay scoring algorithm with streak multipliers, token-based reconnection for dropped mobile networks, and a dynamic host analytics dashboard. I chose SQLite with `better-sqlite3` because its synchronous, zero-network overhead approach in Node easily handled my concurrency requirements while keeping deployments incredibly simple."*

---

## 2. Whiteboard Architecture Explanation

**How to draw it:**
1. Draw a **Client Box** (React SPA).
2. Draw a **Server Box** (Node.js). Inside it, draw two components: **REST Controller** and **Socket Manager (State Machine)**.
3. Draw a **Database Cylinder** (SQLite) and an **In-Memory Store Box** (Map/Cache).
4. Draw lines connecting them based on actions.

**How to explain it:**
*"When a host creates a quiz, the Client makes a standard REST API call to the Express server. The server immediately writes the quiz and questions to SQLite for permanence. However, once the game starts, REST is too slow for gameplay. The client upgrades to a Socket.io WebSocket connection.*

*The server loads the active room into an in-memory Map structure. When the host triggers a question, the server generates a 'deadline timestamp' and broadcasts it. It also sets a server-side `setTimeout`. When players answer, they hit the Socket.io server. The server strictly checks the state machine (is the room in `QUESTION_ACTIVE` mode? Did they answer before the server deadline?). If valid, it calculates points, updates the in-memory tally, writes the answer to SQLite asynchronously, and broadcasts the live tally back to the host. When the server timeout fires, it forcefully transitions the room to `QUESTION_ENDED`, preventing any further answers."*

---

## 3. Resume-Ready Project Bullets

- Built a real-time multiplayer quiz platform using **Node.js, Express, React, and Socket.io**, supporting highly concurrent gameplay with sub-second latency.
- Architected a **server-authoritative strict state machine** to govern WebSocket events, eliminating race conditions and ensuring deterministic scoring regardless of client-side clock manipulation.
- Implemented a time-decay scoring algorithm with Kahoot-style **streak multipliers**, backed by a custom **SQLite** relational schema optimized for high-speed read/writes using WAL journaling.
- Designed a **token-based reconnection protocol** that securely restores game state for dropped connections, combined with live host analytics tracking fastest responders and dynamic question difficulty.

---

## 4. Top 30 Sparq Interview Questions & Answers

### Architecture & Decisions
**1. Why did you use SQLite instead of MySQL or MongoDB?**
> "I needed a database that could handle high concurrency without network latency overhead. `better-sqlite3` operates synchronously within the Node process, making reads/writes instantaneous. Since the scale didn't require distributed horizontal scaling yet, it provided enterprise-grade relational integrity without the deployment complexity of a separate DB server."

**2. Why separate REST APIs from WebSockets? Why not use Sockets for everything?**
> "Creating a quiz is a persistent, stateless, one-off action. REST is perfect for this. WebSockets carry overhead and state. By separating them, the application is more scalable—I don't hold open socket connections while a user is just typing out their questions."

**3. What is a server-authoritative architecture?**
> "It means the client is treated as untrusted. The client doesn't say 'I answered in 5 seconds.' The server records the start time, and when the socket event arrives, the *server* calculates the time difference. The server controls the source of truth for the timer and the score."

**4. How did you handle the timer?**
> "I didn't rely on `setInterval` on the client, because browser tabs throttle timers. Instead, the server generates a future UNIX timestamp (e.g., `Date.now() + 20000`) and sends it to the client. The client simply renders a visual countdown to that exact timestamp."

### WebSockets & Real-Time
**5. What is the difference between WebSockets and Socket.io?**
> "WebSockets are the underlying HTML5 protocol for full-duplex communication. Socket.io is a library that wraps WebSockets, providing automatic reconnections, broadcasting, and 'rooms' (which I heavily utilized for grouping quiz players)."

**6. How do you prevent a player from answering twice?**
> "When an answer arrives, I check if the participant ID already exists in the `answers` table for that specific `question_id`. I also strictly check if the room state is `QUESTION_ACTIVE`."

**7. How do you handle dropped connections?**
> "When a player joins, the server generates a secure random token and returns it. The client stores this in `localStorage` or `sessionStorage`. If their phone drops connection and they refresh, the app emits a `rejoin` event with the token, and the server seamlessly reconnects their socket to their existing participant record and score."

**8. What happens if the host disconnects during a live question?**
> "The room's state remains safely in memory and in the DB. The server's `setTimeout` will still close the question accurately. When the host reconnects, they hit the `host:joinRoom` event, which rebinds their new socket ID to the host controls, and the game continues."

### Node.js & Concurrency
**9. How does Node.js handle multiple players answering at the exact same time if it's single-threaded?**
> "Node is single-threaded but uses the Event Loop for asynchronous I/O. When 50 players answer at once, the V8 engine quickly queues the socket events. Because the actual database writes are offloaded to C++ bindings in `better-sqlite3` (or the thread pool), the main thread is never blocked, allowing it to process the game logic for all 50 players concurrently."

**10. What is a race condition, and how did you prevent it?**
> "A race condition is when timing affects the outcome—like an answer arriving at the exact millisecond the timer ends. I prevented this with a strict state machine. If the server timer fires, the state immediately shifts to `QUESTION_ENDED`. Any answer arriving afterward is rejected, period."

**11. Why did you use an In-Memory map for active rooms?**
> "Writing to the database on every single tick or option selection would bottleneck the app. I use an in-memory `Map` to track transient state (like current question counts and timeouts), and only hit the database for permanent records (like saving the final answer or score)."

### Database & SQL
**12. What does `journal_mode = WAL` do in SQLite?**
> "Write-Ahead Logging. It significantly improves concurrency because readers do not block writers, and writers do not block readers. This is crucial for a multiplayer game where people are constantly reading the leaderboard while others are writing answers."

**13. Explain your database schema.**
> "It's a normalized relational schema. A `Room` has many `Questions` and `Participants`. An `Answer` acts as a junction table linking a `Question` and a `Participant`, storing what they answered, if it was correct, and how many points they earned."

**14. If you had to scale this to 10,000 concurrent players, what would break first?**
> "The single Node.js instance and the in-memory Map. To scale, I would need to deploy multiple Node instances behind a load balancer. I would have to replace the in-memory Map with **Redis**, use the **Socket.io Redis Adapter** to sync events across servers, and migrate SQLite to **PostgreSQL** or **MySQL**."

**15. How did you handle graceful database migrations without losing data?**
> "Because the app is already deployed, wiping the database wasn't an option. When I added the streak feature, I used a `try/catch` block wrapping an `ALTER TABLE participants ADD COLUMN streak` query during server initialization to safely apply the schema update."

### Features & Implementation
**16. How does the streak multiplier work?**
> "It tracks a `streak` integer on the `participants` table. If `isCorrect` is true, streak increments. The points formula multiplies the base score by `1 + (min(streak, 5) * 0.1)`. If they get it wrong, streak resets to 0."

**17. How did you calculate the fastest responder?**
> "When the question ends, I query all correct answers for that question, sort them by `response_time_ms` ascending, and pull the first record. This is broadcasted to the host."

**18. How did you implement dynamic difficulty rating?**
> "When finalizing the quiz, I calculate the accuracy percentage for each question. `<40%` is marked Hard, `>75%` is Easy, and the rest is Medium. This requires no ML, just statistical aggregation."

### React & Frontend Architecture
**19. Why did you use Vite instead of Create React App?**
> "Vite uses ES modules natively during development, which means hot module replacement (HMR) is virtually instantaneous regardless of app size, drastically speeding up development compared to CRA's Webpack bundling."

**20. How do you manage global state in the React app?**
> "For this specific scale, I avoided Redux or Context API overhead. Real-time game state is derived entirely from WebSocket events (`question:show`, `question:ended`) and held in local component state. Persistent UI state, like the dark mode theme, is handled via `localStorage`."

**21. Explain how your dark/light mode toggle works.**
> "It uses a `Layout` component that reads the current theme from `localStorage`. It applies a `data-theme` attribute to the `document.documentElement`, which triggers CSS variables to swap out colors dynamically using CSS transitions."

**22. How did you implement the glowing UI effects?**
> "I utilized glassmorphism using `backdrop-filter: blur(16px)` along with rgba background colors. The glowing borders were achieved using specific `box-shadow` CSS variables attached to focus and hover states."

### Security & Error Handling
**23. How do you validate incoming REST API payloads?**
> "I integrated `zod` for strict schema validation. When creating a quiz, the payload is parsed against a Zod schema to ensure there are exactly 4 options, a valid correct option, and a name before the database is ever touched."

**24. How did you secure your WebSocket endpoints?**
> "The primary security is the server-authoritative state machine. Clients can emit whatever payloads they want, but the server validates their participant token, checks the room state, and verifies deadlines before processing."

**25. Could a user hack their score by manipulating the JavaScript?**
> "No. The score calculation happens entirely on the Node.js server. The client only sends the `selectedOption`, and the server checks the timestamp and correctness against the database."

### Advanced Topics
**26. How do you handle Cross-Origin Resource Sharing (CORS)?**
> "Currently, it is configured loosely for the portfolio, but in production, both Express and Socket.io CORS policies would strictly whitelist the exact domain of the deployed Vite frontend to prevent cross-site request forgery."

**27. What happens if two people join with the same name?**
> "In the `player:join` socket handler, I run a synchronous SQLite query to check if the name already exists in the `participants` table for that specific `room_id`. If it does, the server emits an error preventing them from joining."

**28. Why didn't you use an ORM like Prisma or Sequelize?**
> "For a real-time multiplayer application, the overhead of an ORM was unnecessary. Writing raw, parameterized SQL queries with `better-sqlite3` gave me absolute control over performance and transactions, which is crucial for reducing latency."

**29. How do you handle transaction safety when creating a quiz?**
> "Creating a quiz involves writing to the `rooms` table, getting the ID, and then inserting multiple rows into the `questions` table. I wrapped this entire process in a `db.transaction()` so that if any question fails to insert, the entire room creation rolls back, preventing orphaned data."

**30. What was the most difficult bug you faced?**
> "Handling the backspace behavior on the time limit input. Initially, `parseInt()` evaluated an empty string to `NaN`, falling back to `20` immediately, which prevented users from deleting the number. I fixed this by holding the raw string state in React and only parsing the integer upon API submission."
