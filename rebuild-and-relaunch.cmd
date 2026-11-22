@echo off
setlocal
set "ROOT=%~dp0"
set "FRAME=%ROOT%frame"
set "INPUT=%ROOT%ui-control"
set "ELECTRON=%FRAME%\node_modules\electron\dist\electron.exe"
set "TIMEMAXX_FRAME_DIR=%FRAME%"

echo [1/4] Building Input renderer...
call "%INPUT%\build.cmd"
if errorlevel 1 (
  echo Input build failed.
  exit /b 1
)

echo [2/4] Building Frame renderer and image worker...
pushd "%FRAME%"
call npm.cmd run build
set "BUILD_CODE=%errorlevel%"
popd
if not "%BUILD_CODE%"=="0" (
  echo Frame build failed.
  exit /b 1
)

echo [3/4] Closing running Frame...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%rebuild-and-relaunch.ps1"
if errorlevel 1 (
  echo Could not close the existing Frame. Relaunch aborted.
  exit /b 1
)

echo [4/4] Launching Frame with rebuilt renderer...
set "ELECTRON_CACHE=%FRAME%\.runtime\electron-cache"
set "electron_config_cache=%ELECTRON_CACHE%"
start "" "%ELECTRON%" "%FRAME%"
echo Done. Frame and Input have been relaunched.
endlocal
