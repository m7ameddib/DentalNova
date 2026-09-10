# DNT Dental v1.0.0 — Main Clinic setup helper
# Creates desktop shortcut and ensures ProgramData folders exist.
# Run from the Main-Clinic folder after copying or installing files.
param(
  [string]$InstallDir = '',
  [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'
$SourceDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $SourceDir 'server\dist\main.js'))) {
  throw "Run this script from the Main-Clinic folder (server\dist\main.js not found)."
}
if (-not $InstallDir) { $InstallDir = $SourceDir }

$DataDir = Join-Path $env:ProgramData 'DibNova\DNTDental'
Write-Host "DentalNova Main Clinic"
Write-Host "Program folder: $InstallDir"
Write-Host "Clinic data:    $DataDir"

if ($InstallDir -ne $SourceDir) {
  Write-Host "Copying files to $InstallDir ..."
  if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null }
  Get-ChildItem -Path $SourceDir -Force | ForEach-Object {
    if ($_.Name -eq 'install-main-clinic.ps1') { return }
    $dest = Join-Path $InstallDir $_.Name
    if ($_.PSIsContainer) {
      Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    } else {
      Copy-Item -Path $_.FullName -Destination $dest -Force
    }
  }
}

foreach ($sub in @('data', 'attachments', 'backups', 'logs', 'config', 'license')) {
  $path = Join-Path $DataDir $sub
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Force -Path $path | Out-Null }
}

$launcher = Join-Path $InstallDir 'DNT-Dental.vbs'
$iconPath = Join-Path $InstallDir 'dnt-dental.ico'
$shell = New-Object -ComObject WScript.Shell

function New-DntShortcut {
  param(
    [string]$Path,
    [string]$Description
  )
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = 'wscript.exe'
  $shortcut.Arguments = "`"$launcher`""
  $shortcut.WorkingDirectory = $InstallDir
  if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
  }
  $shortcut.Description = $Description
  $shortcut.Save()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop 'DentalNova.lnk'
New-DntShortcut -Path $desktopShortcut -Description 'DentalNova — Main Clinic'
Write-Host "Desktop shortcut: $desktopShortcut"

$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'DentalNova'
if (-not (Test-Path $startMenu)) {
  New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
}
$startMenuShortcut = Join-Path $startMenu 'DentalNova.lnk'
New-DntShortcut -Path $startMenuShortcut -Description 'DentalNova — Main Clinic'
Write-Host "Start Menu shortcut: $startMenuShortcut"

if (-not $SkipFirewall) {
  $fwScript = Join-Path $InstallDir 'scripts\install-firewall-rule.ps1'
  if (Test-Path $fwScript) {
    Write-Host 'Installing Windows Firewall rule (Administrator prompt)...'
    try {
      Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$fwScript`"" | Out-Null
    } catch {
      Write-Warning "Firewall rule was not installed. Run scripts\install-firewall-rule.ps1 as Administrator manually."
    }
  }
}

Write-Host ''
Write-Host 'Ready. Launch DentalNova from the desktop shortcut.'
