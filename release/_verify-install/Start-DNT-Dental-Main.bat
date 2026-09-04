@echo off
setlocal EnableDelayedExpansion
title DNT Dental
cd /d "%~dp0"

set DATA_DIR=%ProgramData%\DibNova\DNTDental
set NODE=%~dp0runtime\node\node.exe
if not exist "%NODE%" set NODE=node
set PORT=4000

set DNT_DATA_DIR=%DATA_DIR%
set HOST=0.0.0.0
set SERVE_CLIENT=1
set NODE_ENV=production
set MIGRATIONS_DIR=%~dp0server\database\migrations

for %%D in (data attachments backups logs config license) do (
  if not exist "%DATA_DIR%\%%D" mkdir "%DATA_DIR%\%%D" 2>nul
)

if not exist "%~dp0server\public\index.html" (
  if exist "%~dp0client\dist\index.html" (
    if not exist "%~dp0server\public" mkdir "%~dp0server\public"
    xcopy /E /I /Y "%~dp0client\dist\*" "%~dp0server\public\" >nul
  )
)

cd /d "%~dp0server"

rem Start server if not already running
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:%PORT%/api/health).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "DNT Dental Server" /MIN "%NODE%" dist\main.js
  set /a WAIT=0
  :waitloop
  timeout /t 2 /nobreak >nul
  powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:%PORT%/api/health).StatusCode } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto :open
  set /a WAIT+=1
  if !WAIT! LSS 30 goto :waitloop
  echo DNT Dental server did not start. Check %DATA_DIR%\logs
  pause
  exit /b 1
)

:open
start "" "http://127.0.0.1:%PORT%"
exit /b 0
