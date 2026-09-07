# End-to-end test: Online subscription PENDING -> ACTIVE activation flow
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$TestDir = Join-Path $Root 'server\data\e2e-online-test'
$DbFile = Join-Path $TestDir 'clinic.db'
$Port = 4099
$AdminKey = 'e2e-test-admin-key-' + [guid]::NewGuid().ToString('N')
$AdminUser = 'dibnova-admin'
$AdminPass = 'e2e-admin-pass-' + [guid]::NewGuid().ToString('N')
$JwtSecret = 'e2e-jwt-' + [guid]::NewGuid().ToString('N')
$Base = "http://127.0.0.1:$Port/api"

Write-Host "=== DentalNova Online Subscription E2E Test ===" -ForegroundColor Cyan

if (Test-Path $TestDir) { Remove-Item $TestDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $TestDir | Out-Null

# Build if needed
Push-Location $Root
if (-not (Test-Path 'server\dist\main.js')) {
  Write-Host 'Building server...'
  npm run build:server | Out-Null
}
Pop-Location

$env:DEPLOYMENT_MODE = 'online'
$env:NODE_ENV = 'production'
$env:PORT = "$Port"
$env:HOST = '127.0.0.1'
$env:SERVE_CLIENT = '0'
$env:DATABASE_FILE = $DbFile
$env:JWT_SECRET = $JwtSecret
$env:DIBNOVA_ADMIN_API_KEY = $AdminKey
$env:DIBNOVA_ADMIN_USERNAME = $AdminUser
$env:DIBNOVA_ADMIN_PASSWORD = $AdminPass
$env:MIGRATIONS_DIR = Join-Path $Root 'database\migrations'

# Preflight: better-sqlite3 native binding (required for server startup)
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close();" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw @"
better-sqlite3 native module is missing for Node $(node -v).
Run: npm install
Then: npm approve-scripts better-sqlite3; npm rebuild better-sqlite3
Or use Node 20/22 LTS (prebuilt binaries). Visual Studio Build Tools are required to compile on Node 24.
"@
}

Write-Host "Starting server on port $Port..."
$logFile = Join-Path $TestDir 'server.log'
$serverArgs = @(
  '/c',
  "set DEPLOYMENT_MODE=online&& set NODE_ENV=production&& set PORT=$Port&& set HOST=127.0.0.1&& set SERVE_CLIENT=0&& set DATABASE_FILE=$DbFile&& set JWT_SECRET=$JwtSecret&& set DIBNOVA_ADMIN_API_KEY=$AdminKey&& set DIBNOVA_ADMIN_USERNAME=$AdminUser&& set DIBNOVA_ADMIN_PASSWORD=$AdminPass&& set MIGRATIONS_DIR=$($Root -replace '\\','\\')\\database\\migrations&& cd /d `"$Root\server`" && node dist\main.js > `"$logFile`" 2>&1"
)
$serverProc = Start-Process -FilePath 'cmd.exe' -ArgumentList $serverArgs -PassThru -WindowStyle Hidden

function Wait-Health {
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri "$Base/health" -TimeoutSec 3
      if ($r.ok) { return $r }
    } catch {}
    Start-Sleep -Seconds 1
  }
  if (Test-Path $logFile) {
    Write-Host '--- server.log (last 30 lines) ---' -ForegroundColor Yellow
    Get-Content $logFile -Tail 30 | ForEach-Object { Write-Host $_ }
  }
  throw 'Server did not become healthy'
}

try {
  $health = Wait-Health
  Write-Host "OK  Health: deploymentMode=$($health.deploymentMode) phase=$($health.phase)" -ForegroundColor Green

  if ($health.deploymentMode -ne 'online') { throw "Expected online mode, got $($health.deploymentMode)" }

  # First setup
  $setupBody = @{
    clinicName = 'E2E Test Clinic'
    doctorName = 'Dr Test'
    clinicPhone = '0500000000'
    doctorPhone = '0500000001'
    workingDays = '0,1,2,3,4'
    workStartTime = '09:00'
    workEndTime = '17:00'
    adminUsername = 'admin'
    adminPassword = 'admin12345'
  } | ConvertTo-Json

  $setup = Invoke-RestMethod -Uri "$Base/installation/setup" -Method Post -Body $setupBody -ContentType 'application/json'
  Write-Host "OK  Setup complete: onlineSubscriptionStatus=$($setup.onlineSubscriptionStatus)" -ForegroundColor Green

  $sub = Invoke-RestMethod -Uri "$Base/subscription/status"
  if ($sub.status -ne 'PENDING') { throw "Expected PENDING, got $($sub.status)" }
  if ($sub.canUseSystem) { throw 'Expected canUseSystem=false while PENDING' }
  Write-Host "OK  Subscription PENDING, clinic blocked" -ForegroundColor Green

  # Blocked API access
  try {
    Invoke-RestMethod -Uri "$Base/patients" -Headers @{ Authorization = "Bearer $($setup.accessToken)" }
    throw 'Expected 403 on /patients while PENDING'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw $_ }
    Write-Host 'OK  Protected API blocked (403) while PENDING' -ForegroundColor Green
  }

  # Admin: login with username/password
  $adminLoginBody = @{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json
  $adminSession = Invoke-RestMethod -Uri "$Base/dibnova-admin/auth/login" -Method Post -Body $adminLoginBody -ContentType 'application/json'
  $headers = @{ Authorization = "Bearer $($adminSession.accessToken)" }
  Write-Host 'OK  DibNova admin login' -ForegroundColor Green

  $info = Invoke-RestMethod -Uri "$Base/dibnova-admin/installation" -Headers $headers
  Write-Host "OK  Admin view: clinic=$($info.clinicName) status=$($info.subscription.status)" -ForegroundColor Green

  # Admin: activate
  $activated = Invoke-RestMethod -Uri "$Base/dibnova-admin/subscription/activate" -Method Post -Headers $headers -Body '{}' -ContentType 'application/json'
  if ($activated.status -ne 'ACTIVE') { throw "Expected ACTIVE after activate, got $($activated.status)" }
  if (-not $activated.canUseSystem) { throw 'Expected canUseSystem=true after activate' }
  Write-Host "OK  Activated until $($activated.expiresAt)" -ForegroundColor Green

  # Clinic can access
  $patients = Invoke-RestMethod -Uri "$Base/patients" -Headers @{ Authorization = "Bearer $($setup.accessToken)" }
  Write-Host "OK  Clinic API accessible after activation (patients count: $($patients.Count))" -ForegroundColor Green

  Write-Host ''
  Write-Host '=== ALL E2E TESTS PASSED ===' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Admin UI: open /dibnova-admin and sign in with DIBNOVA_ADMIN_USERNAME/PASSWORD'
} finally {
  if ($serverProc -and -not $serverProc.HasExited) {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $TestDir) { Remove-Item $TestDir -Recurse -Force -ErrorAction SilentlyContinue }
}
