# DNT Dental — Build production release package
param(
  [string]$Version = '',
  [switch]$RequireInstaller
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $Root 'package.json'))) {
  $Root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
}

if (-not $Version) {
  $Version = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Invalid release version: $Version"
}

$OutDir = Join-Path $Root "release\DNT-Dental-v$Version"
$MainDir = Join-Path $OutDir 'Main-Clinic'
$ClientDir = Join-Path $OutDir 'Clinic-Client'

function Remove-DirectoryForce {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  try {
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  } catch {
    cmd /c "rmdir /s /q `"$Path`"" | Out-Null
    if (Test-Path $Path) {
      throw "Failed to remove directory: $Path"
    }
  }
}

function Optimize-ProductionNodeModules {
  param([string]$Path)

  $junkDirs = @(
    'test', 'tests', '__tests__', 'docs', 'doc', '.github',
    'example', 'examples', 'coverage', 'benchmark', 'benchmarks'
  )
  Get-ChildItem -Path $Path -Recurse -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $junkDirs -contains $_.Name } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

  Get-ChildItem -Path $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Extension -in @('.md', '.markdown', '.ts', '.tsx', '.map', '.flow', '.coffee')
    } |
    Remove-Item -Force -ErrorAction SilentlyContinue

  # Remove type-definition packages pulled in transitively — not needed at runtime.
  $typesRoot = Join-Path $Path '@types'
  if (Test-Path $typesRoot) {
    Remove-Item $typesRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Install-ProductionNodeModules {
  param(
    [string]$ServerPackageJson,
    [string]$DestNodeModules,
    [string]$NpmCmd,
    [string]$Root
  )

  $workspaceModules = Join-Path $Root 'node_modules'
  $useWorkspace = ($env:GITHUB_ACTIONS -eq 'true') -or ($env:USE_WORKSPACE_NODE_MODULES -eq '1')
  if ($useWorkspace -and (Test-Path $workspaceModules)) {
    $sqliteNative = Get-ChildItem -Path (Join-Path $workspaceModules 'better-sqlite3') -Recurse -Filter '*.node' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($sqliteNative) {
      Write-Host 'Packaging production node_modules from workspace (post npm ci / prune)...'
      if (Test-Path $DestNodeModules) {
        Remove-DirectoryForce $DestNodeModules
      }
      Copy-Item -Recurse -Force $workspaceModules $DestNodeModules
      Optimize-ProductionNodeModules -Path $DestNodeModules
      return
    }
    Write-Warning 'Workspace node_modules missing better-sqlite3 native binary; falling back to isolated install.'
  }

  $stageDir = Join-Path ([IO.Path]::GetTempPath()) ("dnt-prod-deps-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

  # npm's lifecycle scripts (used by native modules like better-sqlite3 to fetch/build
  # their .node binary) resolve a bare `node` via PATH. If the system PATH already has
  # another Node install ahead of our portable runtime, prebuild-install/node-gyp target
  # the wrong Node version and the native module ends up incompatible (or fails to build
  # entirely without Visual Studio). Force the portable Node's directory to the front of
  # PATH for the duration of this install so the compiled binary matches the runtime we ship.
  $nodeDir = Split-Path $NpmCmd -Parent
  $oldPath = $env:PATH
  try {
    Copy-Item -Force $ServerPackageJson (Join-Path $stageDir 'package.json')
    Push-Location $stageDir
    Write-Host "Installing production dependencies only..."
    $env:PATH = "$nodeDir;$oldPath"
    & $NpmCmd install --omit=dev --no-audit --no-fund --no-package-lock
    if ($LASTEXITCODE -ne 0) {
      throw 'npm install --omit=dev failed'
    }
    Pop-Location

    if (Test-Path $DestNodeModules) {
      Remove-DirectoryForce $DestNodeModules
    }
    Copy-Item -Recurse -Force (Join-Path $stageDir 'node_modules') $DestNodeModules
    Optimize-ProductionNodeModules -Path $DestNodeModules
  } finally {
    $env:PATH = $oldPath
    Pop-Location -ErrorAction SilentlyContinue
    Remove-Item $stageDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Sync-Directory {
  param(
    [string]$Source,
    [string]$Destination
  )
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & robocopy $Source $Destination /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Failed to sync $Source -> $Destination (robocopy exit $LASTEXITCODE)"
  }
}

$nodePortable = Join-Path $env:LOCALAPPDATA 'nodejs-portable\node-v22.23.2-win-x64'
$npmCmd = if (Test-Path (Join-Path $nodePortable 'npm.cmd')) {
  Join-Path $nodePortable 'npm.cmd'
} else {
  'npm'
}

Write-Host "Building DNT Dental v$Version..."
Set-Location $Root
# CI runs npm run build before npm prune; devDependencies (vite, nest) are removed by then.
if ($env:GITHUB_ACTIONS -eq 'true') {
  $mainJs = Join-Path $Root 'server\dist\main.js'
  $clientIndex = Join-Path $Root 'client\dist\index.html'
  if (-not (Test-Path $mainJs) -or -not (Test-Path $clientIndex)) {
    throw 'Expected build outputs missing on CI. Run npm run build before build-release.ps1.'
  }
  Write-Host 'Using existing build outputs from CI (skip npm run build after npm prune).'
} else {
  npm run build
}

if (Test-Path $OutDir) { Remove-DirectoryForce $OutDir }
New-Item -ItemType Directory -Force -Path $MainDir, $ClientDir | Out-Null

# Main server package (compiled output only — no source)
$serverDest = Join-Path $MainDir 'server'
$serverDistDest = Join-Path $serverDest 'dist'
New-Item -ItemType Directory -Force -Path $serverDistDest, (Join-Path $serverDest 'database\migrations'), (Join-Path $serverDest 'keys'), (Join-Path $serverDest 'public') | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root 'server\dist\*') $serverDistDest
# Strip TypeScript source maps / incremental build info — debugging artifacts that map
# back to source and are never read at runtime.
Get-ChildItem -Path $serverDistDest -Recurse -File -Include '*.map', '*.tsbuildinfo' -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $Root 'database\migrations\*') (Join-Path $serverDest 'database\migrations')
Copy-Item -Force (Join-Path $Root 'server\keys\license-public.pem') (Join-Path $serverDest 'keys')
Get-ChildItem -Path (Join-Path $Root 'server\keys') -Filter 'license-public-*.pem' -ErrorAction SilentlyContinue |
  ForEach-Object { Copy-Item -Force $_.FullName (Join-Path $serverDest 'keys') }
Copy-Item -Recurse -Force (Join-Path $Root 'client\dist\*') (Join-Path $serverDest 'public')
Copy-Item -Force (Join-Path $Root 'server\.env.example') (Join-Path $serverDest '.env.example')

# Production node_modules — runtime dependencies only
$nodeModulesDest = Join-Path $MainDir 'node_modules'
Install-ProductionNodeModules `
  -ServerPackageJson (Join-Path $Root 'server\package.json') `
  -DestNodeModules $nodeModulesDest `
  -NpmCmd $npmCmd `
  -Root $Root

# Portable Node 22 runtime (if present)
if (Test-Path $nodePortable) {
  Copy-Item -Recurse -Force $nodePortable (Join-Path $MainDir 'runtime\node')
} else {
  Write-Warning 'Portable Node runtime not found — installer will rely on system Node if present.'
}

# Launchers & scripts
Copy-Item -Force (Join-Path $Root 'release\branding\dnt-dental.ico') $MainDir
Copy-Item -Force (Join-Path $Root 'release\launchers\Start-DNT-Dental-Main.ps1') $MainDir
Copy-Item -Force (Join-Path $Root 'release\launchers\DNT-Dental.vbs') $MainDir
Copy-Item -Force (Join-Path $Root 'release\launchers\Start-DNT-Dental-Main.bat') $MainDir
Copy-Item -Force (Join-Path $Root 'release\launchers\Start-DNT-Dental-Client.ps1') $ClientDir
Copy-Item -Force (Join-Path $Root 'release\launchers\DNT-Dental-Client.vbs') $ClientDir
Copy-Item -Force (Join-Path $Root 'release\launchers\Start-DNT-Dental-Client.bat') $ClientDir
Copy-Item -Force (Join-Path $Root 'release\scripts\install-main-clinic.ps1') $MainDir
New-Item -ItemType Directory -Force -Path (Join-Path $MainDir 'scripts') | Out-Null
Copy-Item -Force (Join-Path $Root 'release\scripts\install-firewall-rule.ps1') (Join-Path $MainDir 'scripts')
Copy-Item -Force (Join-Path $Root 'release\scripts\register-autostart.ps1') (Join-Path $MainDir 'scripts')
Copy-Item -Force (Join-Path $Root 'release\INSTALL.md') $OutDir

# Pre-installer verification
$mainJs = Join-Path $MainDir 'server\dist\main.js'
$publicIndex = Join-Path $MainDir 'server\public\index.html'
$backupServiceJs = Join-Path $MainDir 'server\dist\backup\backup.service.js'
$requiredModules = @(
  '@nestjs\core\package.json',
  'better-sqlite3\package.json',
  'adm-zip\package.json',
  'bcryptjs\package.json',
  'multer\package.json'
)
$forbiddenModules = @(
  '@nestjs\cli',
  'typescript'
)

if (-not (Test-Path $mainJs)) { throw "Packaging failed: missing server entrypoint at $mainJs" }
if (-not (Test-Path $publicIndex)) { throw "Packaging failed: missing frontend at $publicIndex" }
if (-not (Test-Path $backupServiceJs)) { throw "Packaging failed: missing backup service at $backupServiceJs" }
if (-not (Select-String -Path $backupServiceJs -Pattern 'adm-zip' -Quiet)) {
  throw 'Packaging failed: backup fix (adm-zip) not present in compiled server'
}

foreach ($rel in $requiredModules) {
  $full = Join-Path $nodeModulesDest $rel
  if (-not (Test-Path $full)) {
    throw "Packaging failed: missing production dependency at $rel"
  }
}

foreach ($rel in $forbiddenModules) {
  $full = Join-Path $nodeModulesDest $rel
  if (Test-Path $full) {
    throw "Packaging failed: dev dependency should not be included: $rel"
  }
}

$sqliteNative = Get-ChildItem -Path (Join-Path $nodeModulesDest 'better-sqlite3') -Recurse -Filter '*.node' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $sqliteNative) {
  throw 'Packaging failed: better-sqlite3 native module (.node) not found'
}

Write-Host "Verified server entrypoint: $mainJs"
Write-Host "Verified frontend bundle: $publicIndex"
Write-Host "Verified backup fix (adm-zip): $backupServiceJs"
Write-Host "Verified better-sqlite3 native: $($sqliteNative.FullName)"

# Compile Inno Setup installer when ISCC is available
$iss = Join-Path $Root 'release\installer\DNT-Dental-Main-Clinic.iss'
$isccCandidates = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
)
$compiledInstaller = $false
foreach ($iscc in $isccCandidates) {
  if (Test-Path $iscc) {
    Write-Host 'Compiling Windows installer with Inno Setup...'
    & $iscc "/DMyAppVersion=$Version" $iss
    if ($LASTEXITCODE -ne 0) {
      throw "Inno Setup compile failed with exit code $LASTEXITCODE"
    }
    $compiledInstaller = $true
    break
  }
}

if ($RequireInstaller -and -not $compiledInstaller) {
  throw 'Inno Setup (ISCC.exe) is required to build the Windows installer but was not found.'
}

# Client package — static UI only (connects to main server via browser)
New-Item -ItemType Directory -Force -Path (Join-Path $ClientDir 'ui') | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root 'client\dist\*') (Join-Path $ClientDir 'ui')

# Version file
Set-Content -Path (Join-Path $OutDir 'VERSION.txt') -Value $Version

# USB delivery folder
$UsbDir = Join-Path $Root 'release\DNT-Dental-USB-Delivery'
New-Item -ItemType Directory -Force -Path $UsbDir | Out-Null
Sync-Directory -Source (Join-Path $OutDir 'Main-Clinic') -Destination (Join-Path $UsbDir 'Main-Clinic')
Sync-Directory -Source (Join-Path $OutDir 'Clinic-Client') -Destination (Join-Path $UsbDir 'Clinic-Client')
Copy-Item -Force (Join-Path $OutDir 'INSTALL.md') $UsbDir
$setupExe = Join-Path $OutDir "DNT-Dental-Main-Clinic-Setup-v$Version.exe"
if (Test-Path $setupExe) {
  Copy-Item -Force $setupExe $UsbDir
  $sha256 = (Get-FileHash $setupExe -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -Path "$setupExe.sha256" -Value $sha256 -Encoding ASCII
  Write-Host "Installer checksum: $sha256"
}

$moduleCount = (Get-ChildItem $nodeModulesDest -Directory).Count
$nodeModulesSize = (Get-ChildItem $nodeModulesDest -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host "Production node_modules: $moduleCount top-level packages, $([math]::Round($nodeModulesSize / 1MB, 1)) MB"
Write-Host "Release package created at: $OutDir"
Write-Host "USB delivery folder updated at: $UsbDir"
if (Test-Path $setupExe) {
  $exeSize = (Get-Item $setupExe).Length
  Write-Host "Installer: $setupExe ($([math]::Round($exeSize / 1MB, 1)) MB)"
}
