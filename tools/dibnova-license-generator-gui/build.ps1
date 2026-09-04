# DibNova License Generator — build standalone Windows GUI (internal use only)
$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
$GuiDir = $PSScriptRoot
$SourceGenerator = Join-Path $Root 'tools\dibnova-license-generator'
$PrivateKeySource = Join-Path $SourceGenerator 'keys\license-private.pem'

if (-not (Test-Path $PrivateKeySource)) {
  throw "Missing existing private key at $PrivateKeySource"
}

Write-Host 'Installing PyInstaller (build tool only)...'
python -m pip install --upgrade pyinstaller -q

if (Test-Path (Join-Path $GuiDir 'dist')) {
  Remove-Item (Join-Path $GuiDir 'dist') -Recurse -Force
}

Write-Host 'Building DibNova License Generator.exe...'
Set-Location $GuiDir
python -m PyInstaller `
  --noconfirm `
  --windowed `
  --name 'DibNova License Generator' `
  --distpath 'dist' `
  --workpath 'build' `
  --specpath 'build' `
  app.py

$DistDir = Join-Path $GuiDir 'dist\DibNova License Generator'
$GeneratorDest = Join-Path $DistDir 'generator'
$RuntimeDest = Join-Path $DistDir 'runtime\node'
$KeysDest = Join-Path $GeneratorDest 'keys'
New-Item -ItemType Directory -Force -Path $KeysDest, (Join-Path $GeneratorDest 'output'), $RuntimeDest | Out-Null

Copy-Item -Force (Join-Path $SourceGenerator 'generate-license.js') $GeneratorDest
Copy-Item -Force $PrivateKeySource (Join-Path $KeysDest 'license-private.pem')

$nodePortable = Join-Path $env:LOCALAPPDATA 'nodejs-portable\node-v22.23.2-win-x64'
if (-not (Test-Path $nodePortable)) {
  throw "Portable Node runtime not found at $nodePortable"
}
Copy-Item -Recurse -Force (Join-Path $nodePortable '*') $RuntimeDest

$builtExe = Join-Path $DistDir 'DibNova License Generator.exe'
if (-not (Test-Path $builtExe)) {
  throw "Build failed: $builtExe was not created"
}

Write-Host "Built: $builtExe"

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'DibNova License Generator.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $builtExe
$shortcut.WorkingDirectory = $DistDir
$shortcut.Description = 'DibNova License Generator (internal)'
$shortcut.Save()

Write-Host "Desktop shortcut: $shortcutPath"
Write-Host ''
Write-Host 'Ready. Double-click the desktop shortcut to generate clinic licenses.'
