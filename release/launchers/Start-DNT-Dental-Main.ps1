# DNT Dental Main Clinic — hidden launcher (no console during normal use)
Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference = 'Stop'
# Launchers are installed in the DNT Dental root (e.g. C:\Program Files\DibNova\DNTDental\)
$AppRoot = $PSScriptRoot

$DataDir = Join-Path $env:ProgramData 'DibNova\DNTDental'
$Port = if ($env:PORT) { $env:PORT } else { '4000' }
$NodeExe = Join-Path $AppRoot 'runtime\node\node.exe'
if (-not (Test-Path $NodeExe)) { $NodeExe = 'node' }

foreach ($sub in @('data', 'attachments', 'backups', 'logs', 'config', 'license')) {
  $path = Join-Path $DataDir $sub
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
}

$env:DNT_DATA_DIR = $DataDir
$env:DEPLOYMENT_MODE = 'offline'
$env:HOST = '0.0.0.0'
$env:SERVE_CLIENT = '1'
$env:NODE_ENV = 'production'
$env:PORT = $Port
$env:MIGRATIONS_DIR = Join-Path $AppRoot 'server\database\migrations'

$publicDir = Join-Path $AppRoot 'server\public'
$clientDist = Join-Path $AppRoot 'client\dist'
if (-not (Test-Path (Join-Path $publicDir 'index.html'))) {
  if (Test-Path (Join-Path $clientDist 'index.html')) {
    New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
    Copy-Item -Path (Join-Path $clientDist '*') -Destination $publicDir -Recurse -Force
  }
}

function Test-DntPortListening {
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Where-Object { $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '::' }
    return $null -ne $conn
  } catch {
    return $false
  }
}

function Test-DntHealth {
  param([int]$TimeoutSec = 5)
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec $TimeoutSec "http://127.0.0.1:$Port/api/health"
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-DntHealth {
  param([int]$TimeoutSec = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-DntHealth) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

if (-not (Test-DntHealth)) {
  if (Test-DntPortListening) {
    if (-not (Wait-DntHealth)) {
      [System.Windows.Forms.MessageBox]::Show(
        "DNT Dental server is busy or not responding.`nPlease wait a moment and try again.`nLogs: $(Join-Path $DataDir 'logs')",
        'DNT Dental',
        'OK',
        'Error'
      ) | Out-Null
      exit 1
    }
  } else {
    $serverDir = Join-Path $AppRoot 'server'
  $mainJs = Join-Path $serverDir 'dist\main.js'
  if (-not (Test-Path $mainJs)) {
    [System.Windows.Forms.MessageBox]::Show(
      "DNT Dental server files are missing.`nExpected: $mainJs",
      'DNT Dental',
      'OK',
      'Error'
    ) | Out-Null
    exit 1
  }

  $logDir = Join-Path $DataDir 'logs'
  $logFile = Join-Path $logDir 'server-launcher.log'
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $NodeExe
  $psi.Arguments = "`"$mainJs`""
  $psi.WorkingDirectory = $serverDir
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

  foreach ($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
    if ($entry.Key -is [string] -and $entry.Value -is [string]) {
      $psi.EnvironmentVariables[$entry.Key] = $entry.Value
    }
  }
  foreach ($key in @('DNT_DATA_DIR', 'DEPLOYMENT_MODE', 'HOST', 'SERVE_CLIENT', 'NODE_ENV', 'PORT', 'MIGRATIONS_DIR')) {
    $psi.EnvironmentVariables[$key] = [Environment]::GetEnvironmentVariable($key)
  }

  $proc = [System.Diagnostics.Process]::Start($psi)
  $proc.BeginOutputReadLine() | Out-Null
  $proc.BeginErrorReadLine() | Out-Null
  Add-Content -Path $logFile -Value "Started server PID $($proc.Id) at $(Get-Date -Format o)"

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if (Test-DntHealth) { break }
  }

    if (-not (Wait-DntHealth)) {
      [System.Windows.Forms.MessageBox]::Show(
        "DNT Dental server did not start.`nCheck logs in:`n$logDir",
        'DNT Dental',
        'OK',
        'Error'
      ) | Out-Null
      exit 1
    }
  }
}

Start-Process "http://127.0.0.1:$Port"
