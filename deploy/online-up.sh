#!/usr/bin/env bash
# Deploy DentalNova online to a Linux server with Docker Compose + Caddy (HTTPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Creating .env from deploy/.env.online.example — edit JWT_SECRET before production use."
  cp deploy/.env.online.example .env
  echo ""
  echo "IMPORTANT: Set JWT_SECRET in .env before going live."
  echo "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
  echo ""
fi

if grep -q 'REPLACE_WITH_STRONG_SECRET' .env 2>/dev/null; then
  echo "ERROR: Replace JWT_SECRET in .env before deploying."
  exit 1
fi

echo "Building and starting DentalNova online stack..."
docker compose build
docker compose up -d

echo ""
echo "DentalNova online deployment started."
echo "  Domain: $(grep '^DOMAIN=' .env | cut -d= -f2- || echo dentalnova.dibnova.com)"
echo "  Logs:   docker compose logs -f app"
echo "  Stop:   docker compose down"
