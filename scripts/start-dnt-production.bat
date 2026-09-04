@echo off
setlocal
set NODE_DIR=%LOCALAPPDATA%\nodejs-portable\node-v22.23.2-win-x64
set PATH=%NODE_DIR%;%PATH%

cd /d "%~dp0.."

if not exist "client\dist\index.html" (
  echo Building client...
  call "%NODE_DIR%\npm.cmd" run build:client
)

if not exist "server\dist\main.js" (
  echo Building server...
  call "%NODE_DIR%\npm.cmd" run build:server
)

if not exist "server\public\index.html" (
  echo Syncing client build to server\public...
  if not exist "server\public" mkdir "server\public"
  xcopy /E /I /Y "client\dist\*" "server\public\" >nul
)

cd server
set SERVE_CLIENT=1
set NODE_ENV=production
set HOST=0.0.0.0
echo Starting DNT Dental...
start "" "http://127.0.0.1:4000"
"%NODE_DIR%\node.exe" dist/main.js
