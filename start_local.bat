@echo off
echo ===================================================
echo             Starting Sparq Locally
echo ===================================================
echo.

echo [1/2] Starting Backend Server (Port 4000)...
start "Sparq Backend" cmd /k "cd backend && npm install && npm start"

echo [2/2] Starting Frontend Server (Port 5173)...
start "Sparq Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo ===================================================
echo Servers are starting in separate windows.
echo Please wait a few seconds for them to initialize.
echo.
echo Frontend will be available at: http://localhost:5173
echo ===================================================
pause
