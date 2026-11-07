@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
rem Stops ONLY this game's server (PID recorded in data\server.pid) - never other apps on port 3000.
if not exist "data\server.pid" (
  echo Khong tim thay may chu CAT FISHING LIVE dang chay.
  timeout /t 2 >nul
  exit /b 0
)
set /p PID=<"data\server.pid"
tasklist /FI "PID eq %PID%" /FI "IMAGENAME eq node.exe" | findstr /I "node.exe" >nul
if errorlevel 1 (
  echo May chu da tat tu truoc.
) else (
  taskkill /PID %PID% /T /F >nul 2>nul
  echo Da tat CAT FISHING LIVE ^(PID %PID%^).
)
del "data\server.pid" >nul 2>nul
timeout /t 2 >nul
