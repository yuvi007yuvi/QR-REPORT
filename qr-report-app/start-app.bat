@echo off
echo Starting Backend Proxy Server...
start "Backend Server" /D ".\backend" cmd /k "npm start"

echo Starting Frontend Application...
start "Frontend App" cmd /k "npm run dev"

echo Both services are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
pause
