@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run build
exit /b %errorlevel%
