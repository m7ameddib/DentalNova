# Sync DentalNova version across package manifests and runtime constant.
param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = 'Stop'

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must be semver like 1.2.3 (got: $Version)"
}

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $Root 'package.json'))) {
  $Root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Update-JsonVersion {
  param(
    [string]$Path,
    [switch]$IncludeWorkspaceDependency
  )
  if (-not (Test-Path $Path)) { return }
  $content = Get-Content $Path -Raw
  $content = [regex]::Replace($content, '"version"\s*:\s*"[^"]+"', "`"version`": `"$Version`"", 1)
  if ($IncludeWorkspaceDependency) {
    $content = [regex]::Replace(
      $content,
      '"@dnt/dental-server"\s*:\s*"[^"]+"',
      "`"@dnt/dental-server`": `"$Version`""
    )
  }
  Write-Utf8NoBom -Path $Path -Content $content
}

Update-JsonVersion (Join-Path $Root 'package.json') -IncludeWorkspaceDependency
Update-JsonVersion (Join-Path $Root 'server\package.json')
Update-JsonVersion (Join-Path $Root 'client\package.json')

$versionTs = Join-Path $Root 'server\src\common\version.ts'
Write-Utf8NoBom -Path $versionTs -Content "export const APP_VERSION = '$Version';`n"

Write-Host "Synced version $Version in package.json files and server/src/common/version.ts"
