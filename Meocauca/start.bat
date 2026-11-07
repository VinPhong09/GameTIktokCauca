@echo off
setlocal
chcp 65001 >nul
title CAT FISHING LIVE - Ho Cau Ca Meo
cd /d "%~dp0"

echo ==============================================
echo   CAT FISHING LIVE - HO CAU CA MEO
echo ==============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js. Tai tai https://nodejs.org ^(ban 20 tro len^).
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo [1/3] Cai dat thu vien backend...
  call npm --prefix backend install --no-audit --no-fund
  if errorlevel 1 goto :fail
)
if not exist "frontend\node_modules" (
  echo [2/3] Cai dat thu vien frontend...
  call npm --prefix frontend install --no-audit --no-fund
  if errorlevel 1 goto :fail
)

set NEED_BUILD=0
if not exist "frontend\dist\index.html" set NEED_BUILD=1
if /i "%~1"=="rebuild" set NEED_BUILD=1
if "%NEED_BUILD%"=="1" (
  echo [3/3] Build giao dien...
  call npm --prefix frontend run build
  if errorlevel 1 goto :fail
)

rem Stop a previous instance of THIS game only (PID recorded in data\server.pid).
if exist "data\server.pid" call "%~dp0stop.bat" >nul

rem Refuse to start if another application already uses port 3000 (never kill other apps).
netstat -ano | findstr ":3000 " | findstr LISTENING >nul
if not errorlevel 1 (
  echo.
  echo [LOI] Cong 3000 dang duoc mot ung dung khac su dung.
  echo       Hay tat ung dung do, hoac doi "port" trong config\settings.json.
  pause
  exit /b 1
)

echo.
echo   Game    : http://localhost:3000/game
echo   Admin   : http://localhost:3000/admin
echo   Overlay : http://localhost:3000/overlay
echo   (Dong cua so nay hoac chay stop.bat de tat)
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000/admin"
call npm --prefix backend run start
goto :eof

:fail
echo [LOI] Khoi dong that bai. Xem thong bao phia tren.
pause
exit /b 1
