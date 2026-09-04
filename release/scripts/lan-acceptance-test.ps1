# DNT Dental v1.0.0 — LAN acceptance smoke test (single-machine simulation)
param(
  [string]$ServerHost = '127.0.0.1',
  [int]$Port = 4000,
  [string]$ReleaseRoot = (Join-Path $PSScriptRoot '..\DNT-Dental-v1.0.0')
)

$ErrorActionPreference = 'Stop'
$ClientDir = Join-Path $ReleaseRoot 'Clinic-Client'
$MainDir = Join-Path $ReleaseRoot 'Main-Clinic'
$DataDir = Join-Path $env:ProgramData 'DibNova\DNTDental'

Write-Host '=== DNT Dental LAN Acceptance Test ==='
Write-Host ''

# 1. Client package must not contain a database
Write-Host '[1] Client has no local database...'
$clientDbs = Get-ChildItem -Path $ClientDir -Recurse -Include *.db,*.sqlite,*.sqlite3 -ErrorAction SilentlyContinue
if ($clientDbs) {
  Write-Host "FAIL: Found database files in Clinic-Client:" -ForegroundColor Red
  $clientDbs | ForEach-Object { Write-Host "  $($_.FullName)" }
  exit 1
}
Write-Host 'PASS: Clinic-Client contains no SQLite database files.' -ForegroundColor Green

# 2. Main server health
Write-Host '[2] Main server health endpoint...'
try {
  $health = Invoke-RestMethod -Uri "http://${ServerHost}:${Port}/api/health" -TimeoutSec 5
} catch {
  Write-Host "FAIL: Cannot reach main server at http://${ServerHost}:${Port}/api/health" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}
if (-not $health.ok) {
  Write-Host 'FAIL: Health check returned ok=false' -ForegroundColor Red
  exit 1
}
Write-Host "PASS: Server healthy (version $($health.version), phase $($health.phase))." -ForegroundColor Green

# 3. Client connects via API only (no server files in client)
Write-Host '[3] Client package is API-only (no server runtime)...'
$serverInClient = Test-Path (Join-Path $ClientDir 'server')
if ($serverInClient) {
  Write-Host 'FAIL: Clinic-Client contains a server folder.' -ForegroundColor Red
  exit 1
}
Write-Host 'PASS: Clinic-Client has no embedded server.' -ForegroundColor Green

# 4. API reachable from client perspective (same LAN host)
Write-Host '[4] API reachable from client host...'
try {
  $status = Invoke-RestMethod -Uri "http://${ServerHost}:${Port}/api/installation/status" -TimeoutSec 5
  Write-Host "PASS: Installation status via API (phase: $($status.phase))." -ForegroundColor Green
} catch {
  Write-Host 'FAIL: Client cannot query installation status via API.' -ForegroundColor Red
  exit 1
}

# 5. Data lives under ProgramData on main
Write-Host '[5] Main clinic data under ProgramData...'
if (-not (Test-Path $DataDir)) {
  Write-Host "WARN: ProgramData folder not found yet ($DataDir) - expected after first main launch." -ForegroundColor Yellow
} else {
  Write-Host "PASS: ProgramData folder exists: $DataDir" -ForegroundColor Green
  if (Test-Path (Join-Path $DataDir 'data\clinic.db')) {
    Write-Host 'PASS: Main database is under ProgramData (not in Clinic-Client).' -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '=== LAN acceptance checks completed ==='
Write-Host 'Note: Full two-device LAN sync test requires a second Windows PC on the same network.'
Write-Host 'On a second PC, run Clinic-Client\DNT-Dental-Client.vbs and enter this PC LAN IP.'
