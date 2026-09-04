@echo off
setlocal
title DNT Dental
cd /d "%~dp0"

set /p SERVER_HOST=Main clinic computer name or IP [DNT-DENTAL-SERVER]: 
if "%SERVER_HOST%"=="" set SERVER_HOST=DNT-DENTAL-SERVER
set /p SERVER_PORT=Port [4000]: 
if "%SERVER_PORT%"=="" set SERVER_PORT=4000

start "" "http://%SERVER_HOST%:%SERVER_PORT%"
exit /b 0
