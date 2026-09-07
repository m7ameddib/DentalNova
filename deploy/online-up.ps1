# Deploy DentalNova online on Windows (Docker Desktop required)
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (-not (Test-Path '.env')) {
  Copy-Item 'deploy\.env.online.example' '.env'
  Write-Host 'Created .env from deploy/.env.online.example'
  Write-Host 'IMPORTANT: Set JWT_SECRET in .env before production use.'
  Write-Host "  node -e `"console.log(require('crypto').randomBytes(48).toString('base64url'))`""
  exit 1
}

$content = Get-Content '.env' -Raw
if ($content -match 'REPLACE_WITH_STRONG_SECRET') {
  throw 'Replace JWT_SECRET in .env before deploying.'
}

Write-Host 'Building and starting DentalNova online stack...'
docker compose build
docker compose up -d

$domain = 'dentalnova.dibnova.com'
$line = Get-Content '.env' | Where-Object { $_ -match '^DOMAIN=' } | Select-Object -First 1
if ($line) { $domain = ($line -split '=', 2)[1].Trim() }

Write-Host ''
Write-Host 'DentalNova online deployment started.'
Write-Host "  Domain: $domain"
Write-Host '  Logs:   docker compose logs -f app'
Write-Host '  Stop:   docker compose down'
