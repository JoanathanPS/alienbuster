@echo off
setlocal EnableDelayedExpansion

:: AlienBuster Launcher
:: Runs Backend (Python/FastAPI) and Frontend (Node/Vite)
:: Logs output to /logs directory

echo ========================================================
echo   ALIENBUSTER: Invasive Species Early Warning System
echo ========================================================

:: 1. Prepare Environment
if not exist "logs" mkdir logs

:: 2. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+.
    pause
    exit /b
)

:: 3. Check for Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js.
    pause
    exit /b
)

:: 4. Start Backend
echo.
echo [BACKEND] Starting FastAPI on Port 8000...
echo          Logs: logs\backend.log
start "AlienBuster Backend" /MIN cmd /c "python -m uvicorn backend.main:app --reload --port 8000 > logs\backend.log 2>&1"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: 5. Start Frontend
echo.
echo [FRONTEND] Starting Vite Dev Server...
echo           Logs: logs\frontend.log
start "AlienBuster Frontend" /MIN cmd /c "npm run dev > logs\frontend.log 2>&1"

echo.
echo ========================================================
echo   SYSTEM RUNNING
echo ========================================================
echo.
echo   Frontend: http://localhost:8080 (or see logs)
echo   Backend:  http://127.0.0.1:8000
echo.
echo   Check 'logs\backend.log' if ML model fails to load.
echo   Check 'logs\frontend.log' if UI doesn't appear.
echo.
echo   Press any key to STOP all services and exit...
pause >nul

:: 6. Cleanup
echo.
echo [SHUTDOWN] Killing processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq AlienBuster Backend*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq AlienBuster Frontend*" >nul 2>&1
:: Fallback aggressive kill if window title matching fails (common in some terminals)
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo Done.
