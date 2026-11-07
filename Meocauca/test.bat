@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ==== [1/4] Backend unit tests (probability, luck, event pipeline) ====
call npm --prefix backend test
if errorlevel 1 goto :fail
echo ==== [2/4] Frontend typecheck ====
call npm --prefix frontend run typecheck
if errorlevel 1 goto :fail
echo ==== [3/4] Frontend build ====
call npm --prefix frontend run build
if errorlevel 1 goto :fail
echo ==== [4/4] End-to-end smoke test (real server on port 3999, in-memory DB) ====
call node scripts\smoke-test.mjs
if errorlevel 1 goto :fail
echo.
echo ALL TESTS PASSED
exit /b 0
:fail
echo.
echo TESTS FAILED
exit /b 1
