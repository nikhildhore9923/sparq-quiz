# Sparq — Deployment & Migration Plan

Since Sparq is already deployed and active, our top priority has been to ensure the new architecture does not break your existing production environment.

## Deployment Architecture Review

### Does the deployment architecture need to change?
**No.** Because we made the strategic decision to stick with **SQLite** (`better-sqlite3`) rather than forcing a migration to MySQL, your underlying infrastructure requirements remain exactly the same.

1. **Backend Environment**: Your backend still runs via standard Node.js (`node server.js`) and relies on the standard `PORT` environment variable. The SQLite database will continue to be generated and stored locally in the backend directory. 
2. **Frontend Environment**: Your Vite React app still builds using `npm run build`. 
3. **Environment Variables**: The frontend still dynamically connects to the backend using `VITE_SERVER_URL` (as seen in `socket.js` and now `HostCreate.jsx`). As long as this was set correctly in your deployed frontend, no new variables are required.

## Safe Migration Steps

When you are ready to push this code to production, follow these steps to ensure zero downtime or data loss.

### Step 1: Merge the Code
Since all our work is safely on the `sparq-upgrade` branch, you can open a Pull Request on GitHub and merge `sparq-upgrade` into your `main` branch.

### Step 2: Database Migration (Automatic)
The new architecture adds a `streak` column to the `participants` table to support the new Kahoot-style combo multipliers. 
- You do **not** need to manually alter your production database or wipe it. 
- I wrote a **graceful migration script** inside `backend/src/db/database.js` that automatically runs `ALTER TABLE participants ADD COLUMN streak` when the server boots. If the column already exists, it silently catches the error. This ensures your existing production data is perfectly preserved.

### Step 3: Deployment Trigger
If your platform (e.g., Render, Heroku, DigitalOcean, Vercel) is configured to auto-deploy on pushes to `main`, the build will trigger automatically.
- **Backend Build**: `npm install` followed by `npm start`.
- **Frontend Build**: `npm install` followed by `npm run build`.

### Step 4: Verification
Once the deployment finishes:
1. Navigate to your live production URL.
2. Verify the new Dark Mode UI is active.
3. Create a test room and ensure WebSockets connect properly. 
4. Check that the new "Fastest Responder" metric appears when you end a question.
