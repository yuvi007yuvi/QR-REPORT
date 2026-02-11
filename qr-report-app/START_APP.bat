@echo off
echo ========================================
echo  QR Report App - Starting Server
echo ========================================
echo.
echo Please wait while the development server starts...
echo.

cd /d "%~dp0"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found!
echo.

if not exist "node_modules" (
    echo Installing dependencies for the first time...
    echo This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

echo Starting development server...
echo.
echo The app will open in your browser automatically.
echo If not, open: http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm run dev

pause
