# Running Sparq Locally

Since your Render free tier has expired, you can easily run Sparq entirely on your local machine. The application was designed with a local fallback (`http://localhost:4000`), so no configuration changes are necessary!

## Method 1: The One-Click Startup Script (Windows)

I have created a `start_local.bat` file in the root of your project. 
To start the entire application:
1. Double-click **`start_local.bat`** in your project folder.
2. It will automatically open two terminal windows. It will install any missing dependencies and start both the Backend (Port 4000) and the Frontend (Port 5173).
3. Open your browser and go to **`http://localhost:5173`**.

## Method 2: Running Manually (Any OS)

If you prefer to run it manually or you are using a Mac/Linux machine, you will need to open two separate terminal windows.

### Terminal 1: Start the Backend Server
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies (only needed the first time):
   ```bash
   npm install
   ```
3. Start the Node.js server:
   ```bash
   npm start
   ```
   *You should see a message saying: `Quiz server running on http://localhost:4000`*

### Terminal 2: Start the Frontend Application
1. Open a **new** terminal window and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies (only needed the first time):
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *You should see a message saying the server is running on `http://localhost:5173`.*

### Testing it Locally
Once both terminals are running without errors:
1. Open **`http://localhost:5173`** in your browser to act as the Host.
2. Create a quiz.
3. Open a **New Incognito Window** (or a different browser) and go to `http://localhost:5173/join`. Enter the 6-letter room code to join as a Player.

## Note on Database
Your local SQLite database (`quiz.db`) will automatically be created and managed in the `backend/` folder just like it was on Render. All your local test data will be saved there.
