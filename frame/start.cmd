@echo off
setlocal
cd /d "%~dp0"
set "ELECTRON_CACHE=%~dp0.runtime\electron-cache"
set "electron_config_cache=%ELECTRON_CACHE%"
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Installing Frame dependencies...
  call npm.cmd ci
  if errorlevel 1 exit /b %errorlevel%
)
call npm.cmd start
