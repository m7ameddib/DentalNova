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

function Update-JsonVersion {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  $json = Get-Content $Path -Raw | ConvertFrom-Json
  $json.version = $Version
  if ($json.PSObject.Properties.Name -contains 'dependencies') {
    if ($json.dependencies.'@dnt/dental-server') {
      $json.dependencies.'@dnt/dental-server' = $Version
    }
  }
  $json | ConvertTo-Json -Depth 20 | Set-Content $Path -Encoding UTF8
}

Update-JsonVersion (Join-Path $Root 'package.json')
Update-JsonVersion (Join-Path $Root 'server\package.json')
Update-JsonVersion (Join-Path $Root 'client\package.json')

$versionTs = Join-Path $Root 'server\src\common\version.ts'
Set-Content -Path $versionTs -Encoding UTF8 -Value "export const APP_VERSION = '$Version';`n"

Write-Host "Synced version $Version in package.json files and server/src/common/version.ts"
