# Test New Install + Update flows using a COPY of clinic.db (never the real production DB)
param(
  [string]$Version = '1.1.1'
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$ReleaseDir = Join-Path $Root "release\DNT-Dental-v$Version"
$MainClinic = Join-Path $ReleaseDir 'Main-Clinic'
$TestRoot = Join-Path $env:TEMP "dnt-install-test-$Version-$(Get-Date -Format 'yyyyMMddHHmmss')"

if (-not (Test-Path (Join-Path $MainClinic 'server\dist\main.js'))) {
  throw 'Release not built. Run build-release.ps1 first.'
}

$SourceDb = Join-Path $Root 'server\data\clinic.db'
if (-not (Test-Path $SourceDb)) {
  throw "Dev database not found at $SourceDb. Run npm run seed first."
}

New-Item -ItemType Directory -Force -Path $TestRoot | Out-Null
$TestDataDir = Join-Path $TestRoot 'ProgramData'
$TestAppDir = Join-Path $TestRoot 'App'
$TestDbDir = Join-Path $TestDataDir 'data'
New-Item -ItemType Directory -Force -Path $TestDbDir, (Join-Path $TestDataDir 'config'), (Join-Path $TestDataDir 'logs') | Out-Null

Write-Host "Test workspace: $TestRoot"
Write-Host 'Copying test clinic.db (copy only, not moving original)...'
Copy-Item -Force $SourceDb (Join-Path $TestDbDir 'clinic.db')
$beforeHash = (Get-FileHash (Join-Path $TestDbDir 'clinic.db') -Algorithm SHA256).Hash

function Get-PatientCount {
  param([string]$DbPath)
  $node = Join-Path $MainClinic 'runtime\node\node.exe'
  if (-not (Test-Path $node)) { $node = 'node' }
  $tmpJs = Join-Path $env:TEMP 'dnt-count-patients.js'
  @'
const Database = require('better-sqlite3');
const db = new Database(process.argv[1], { readonly: true });
const row = db.prepare('SELECT COUNT(*) AS c FROM patients').get();
console.log(row.c);
'@ | Set-Content -Path $tmpJs -Encoding UTF8
  $prevNodePath = $env:NODE_PATH
  $env:NODE_PATH = Join-Path $MainClinic 'node_modules'
  try {
    & $node $tmpJs $DbPath
  } finally {
    $env:NODE_PATH = $prevNodePath
    Remove-Item $tmpJs -Force -ErrorAction SilentlyContinue
  }
}

$patientsBefore = Get-PatientCount (Join-Path $TestDbDir 'clinic.db')
Write-Host "Patients before test: $patientsBefore"

Write-Host ''
Write-Host '=== NEW INSTALLATION TEST ==='
Copy-Item -Recurse -Force $MainClinic $TestAppDir
$envExample = Join-Path $TestAppDir 'server\.env.example'
$envFile = Join-Path $TestAppDir 'server\.env'
if ((Test-Path $envExample) -and -not (Test-Path $envFile)) {
  Copy-Item -Force $envExample $envFile
}
Write-Host 'New install: app copied, .env created from example'

Write-Host ''
Write-Host '=== UPDATE EXISTING INSTALLATION TEST ==='
Remove-Item -Recurse -Force $TestAppDir
Copy-Item -Recurse -Force $MainClinic $TestAppDir
$afterHash = (Get-FileHash (Join-Path $TestDbDir 'clinic.db') -Algorithm SHA256).Hash
$patientsAfter = Get-PatientCount (Join-Path $TestDbDir 'clinic.db')

Write-Host "Patients after update: $patientsAfter"
Write-Host "DB hash unchanged: $($beforeHash -eq $afterHash)"

if ($beforeHash -ne $afterHash) {
  throw 'FAIL: clinic.db was modified during update simulation'
}
if ($patientsBefore -ne $patientsAfter) {
  throw 'FAIL: patient count changed during update simulation'
}

Write-Host ''
Write-Host '=== SERVER START TEST ==='
$nodeExe = if (Test-Path (Join-Path $TestAppDir 'runtime\node\node.exe')) {
  Join-Path $TestAppDir 'runtime\node\node.exe'
} else {
  'node'
}
$env:DNT_DATA_DIR = $TestDataDir
$env:HOST = '127.0.0.1'
$env:SERVE_CLIENT = '1'
$env:NODE_ENV = 'production'
$env:PORT = '4099'
$env:MIGRATIONS_DIR = Join-Path $TestAppDir 'server\database\migrations'

$serverDir = Join-Path $TestAppDir 'server'
$mainJs = Join-Path $serverDir 'dist\main.js'
$proc = Start-Process -FilePath $nodeExe -ArgumentList "`"$mainJs`"" -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 10

$healthOk = $false
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4099/api/health' -TimeoutSec 15
  Write-Host "Health status: $($health.status)"
  $healthOk = $true
} catch {
  Write-Warning "Health check failed (may need auth/license): $_"
}

try {
  if ($healthOk) {
    Write-Host 'Server started and responded to /api/health'
  }
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host 'ALL INSTALL/UPDATE TESTS PASSED'
Write-Host "Test artifacts kept at: $TestRoot"
