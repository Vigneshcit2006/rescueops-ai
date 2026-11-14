@echo off
REM Double-click this file to start RescueOps AI (backend + frontend).
REM Backend:  http://localhost:8020  (API docs at /docs)
REM Frontend: http://localhost:5173

set ROOT=%~dp0

start "RescueOps Backend" cmd /k "cd /d "%ROOT%backend" && venv\Scripts\python -m uvicorn app.main:app --port 8020 --reload"

timeout /t 2 /nobreak >nul

start "RescueOps Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev -- --port 5173"

timeout /t 3 /nobreak >nul

start "" "http://localhost:5173"
