# DentalNova Deployment Guide

DentalNova is **one codebase** with two deployment modes controlled by `DEPLOYMENT_MODE`:

| Mode | Target | Database | License | Access |
|------|--------|----------|---------|--------|
| **offline** | Windows desktop installer | Local SQLite (`ProgramData`) | Required | Browser → `localhost:4000` |
| **online** | Cloud (Docker + Caddy) | Persistent SQLite volume | Not required | Browser → `https://dentalnova.dibnova.com` |

All business logic, UI, API routes, and migrations are shared. Only configuration and packaging differ.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React SPA (client/) — same build for both modes            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP /api
┌───────────────────────────▼─────────────────────────────────┐
│  NestJS API (server/) — DEPLOYMENT_MODE=offline|online      │
│  Controllers → Services → Repositories → SQLite             │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │ offline                             │ online
         ▼                                     ▼
  C:\ProgramData\DibNova\...            Docker volume /data
  (Windows installer)                   (cloud persistent storage)
```

---

## Development

### Prerequisites

- Node.js 20+ (22 recommended)
- npm 9+

```bash
npm install
copy server\.env.example server\.env   # Windows
# cp server/.env.example server/.env   # Linux/macOS
```

### Offline development (default)

```bash
# Terminal 1 — API (offline mode, license flow enabled)
npm run dev:server

# Terminal 2 — UI with hot reload
npm run dev:client
```

Open http://localhost:5173 (UI proxies `/api` → `:4000`).

Optional seed data: `npm run seed`

### Online development (simulate cloud locally)

1. Set a strong JWT secret in `server/.env`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. Add to `server/.env`:
   ```
   DEPLOYMENT_MODE=online
   JWT_SECRET=<generated-secret>
   CORS_ORIGINS=http://localhost:4000
   ```
3. Run:
   ```bash
   npm run build
   npm run dev:online          # API in online mode
   # Or serve production build:
   cross-env DEPLOYMENT_MODE=online SERVE_CLIENT=1 npm run start:prod --workspace=server
   ```

Online mode skips license activation — first visit goes directly to clinic setup.

---

## Online deployment (production)

**Target:** https://dentalnova.dibnova.com  
**Stack:** Docker + Caddy (automatic HTTPS via Let's Encrypt)

### Server requirements

- Linux VPS (Ubuntu 22.04+ recommended)
- Docker Engine + Docker Compose v2
- DNS A record: `dentalnova.dibnova.com` → server IP
- Ports 80 and 443 open

### Deploy

```bash
# 1. Clone and enter the repo
git clone <repo-url> dentalnova && cd dentalnova

# 2. Create environment file
cp deploy/.env.online.example .env

# 3. Generate and set JWT_SECRET in .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 4. Verify DOMAIN and CORS_ORIGINS match your public URL
#    DOMAIN=dentalnova.dibnova.com
#    CORS_ORIGINS=https://dentalnova.dibnova.com

# 5. Deploy
./deploy/online-up.sh          # Linux
# or
powershell deploy/online-up.ps1  # Windows with Docker Desktop
```

### Online commands

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build the production Docker image |
| `npm run docker:up` | Start app + Caddy in background |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | Tail application logs |
| `docker compose ps` | Check container status |
| `docker compose restart app` | Restart after env change |

### Data persistence

Clinic data lives in the Docker volume `dentalnova-data`:

- Database: `/data/data/clinic.db`
- Attachments: `/data/attachments/`
- Backups: `/data/backups/`

Backup the volume before major upgrades:
```bash
docker run --rm -v dentalnova-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/dentalnova-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### First-time online setup

1. Open https://dentalnova.dibnova.com
2. Complete clinic setup (no license step in online mode)
3. Log in with the admin account you create

---

## Offline deployment (Windows installer)

**Target:** Windows desktop — fully offline, local SQLite, clinic data stays on the machine.

### Build the installer

Requires: Node.js, npm, Inno Setup 6 (optional, for `.exe` installer)

```bash
npm run release:offline
# or directly:
powershell -ExecutionPolicy Bypass -File release/scripts/build-release.ps1
```

Output:
- `release/DNT-Dental-v1.1.3/Main-Clinic/` — server + UI + portable Node
- `release/DNT-Dental-v1.1.3/DNT-Dental-Main-Clinic-Setup-v1.1.3.exe` — Windows installer (if Inno Setup installed)
- `release/DNT-Dental-USB-Delivery/` — USB-ready copy

### Install on a clinic PC

1. Run `DNT-Dental-Main-Clinic-Setup-v1.1.3.exe` (or copy `Main-Clinic/` from USB)
2. Launch **DNT Dental** from the desktop shortcut
3. Activate with your license key
4. Complete first-time clinic setup

Data is stored at `C:\ProgramData\DibNova\DNTDental\` (separate from program files).

### Offline commands

| Command | Description |
|---------|-------------|
| `npm run build:offline` | Production build for offline packaging |
| `npm run release:offline` | Full Windows release + installer |
| `scripts/start-dnt-production.bat` | Run production build locally |

The offline launcher sets `DEPLOYMENT_MODE=offline` automatically.

---

## Environment variables

| Variable | Offline | Online | Description |
|----------|---------|--------|-------------|
| `DEPLOYMENT_MODE` | `offline` | `online` | Deployment target |
| `JWT_SECRET` | optional (file fallback) | **required** | Session signing key |
| `DNT_DATA_DIR` | `ProgramData\...` | `/data` | Persistent data root |
| `SERVE_CLIENT` | `1` | `1` | Serve React UI from API |
| `CORS_ORIGINS` | — | domain URL | Allowed browser origins |
| `DOMAIN` | — | `dentalnova.dibnova.com` | Caddy HTTPS domain |
| `GEMINI_API_KEY` | optional | optional | AI assistant |
| `DIBNOVA_ADMIN_USERNAME` | optional | **required** | DibNova admin sign-in username |
| `DIBNOVA_ADMIN_PASSWORD` | optional | **required** | DibNova admin sign-in password (server-side only) |
| `DIBNOVA_ADMIN_API_KEY` | — | optional | Automation/scripts only — not used in the browser UI |
| `DIBNOVA_ADMIN_JWT_EXPIRES_IN` | — | optional | Admin session length (default `8h`) |
| `GITHUB_RELEASES_REPO` | optional | — | Offline update source (default: `m7ameddib/DentalNova`) |

See `server/.env.example` (offline) and `deploy/.env.online.example` (online).

---

## Online subscription management (DibNova admin)

Online clinics start **PENDING** after first setup. Only DibNova admins can activate, extend, suspend, or reactivate subscriptions.

Set `DIBNOVA_ADMIN_USERNAME` and `DIBNOVA_ADMIN_PASSWORD` on the online server (see `deploy/.env.online.example`). These credentials are validated server-side only — they are never entered as an API key in the browser.

### Online entry flow

Online deployments use a **login-first** entry experience:

1. **`/login`** — default landing page for all browsers and devices.
2. **Existing clinics** (server `phase: ready`) always see sign-in — clinic state comes from the server database, not the browser.
3. **New clinics** — when no clinic exists yet (`phase: setup`), users choose **Create New Clinic** to open **`/setup`** (first-time setup runs once per server).
4. After sign-in, **subscription status** applies as before: `PENDING` → waiting page; `ACTIVE` → full app; `EXPIRED`/`SUSPENDED` → restricted.

Offline deployments are unchanged: license activation → mandatory first setup → login.

### Admin UI (inside DentalNova)

Open **`https://<your-clinic-domain>/dibnova-admin`** on the clinic’s DentalNova URL (same app — not a separate admin site).

1. Sign in at **`/dibnova-admin`** with your **DibNova admin username and password**.
2. Review clinic name, installation ID, subscription status, and expiry.
3. Use **Activate (1 year)** when status is `PENDING`.
4. Use **Extend**, **Suspend**, or **Reactivate** as needed.

While subscription is not active, the clinic sees **Awaiting activation** at `/subscription-status`, with a link to **DibNova administrator access** → `/dibnova-admin`. The admin panel remains reachable even when the clinic is blocked.

### Admin API

**Browser UI:** `POST /api/dibnova-admin/auth/login` with `{ "username", "password" }` → use returned JWT as `Authorization: Bearer <token>`.

**Automation (optional):** header `X-DibNova-Admin-Key: <DIBNOVA_ADMIN_API_KEY>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dibnova-admin/installation` | Clinic + subscription/license info |
| POST | `/api/dibnova-admin/subscription/activate` | PENDING → ACTIVE (1 year) |
| POST | `/api/dibnova-admin/subscription/extend` | Extend active subscription by 1 year |
| POST | `/api/dibnova-admin/subscription/suspend` | Suspend clinic (`{ "reason": "..." }`) |
| POST | `/api/dibnova-admin/subscription/reactivate` | SUSPENDED/EXPIRED → ACTIVE (1 year) |

Offline licensing is unchanged — use the existing `tools/dibnova-license-generator` (separate from online subscriptions).

---

## Offline updates (GitHub Releases)

In **offline desktop mode**, open **Settings → Updates** to check [GitHub Releases](https://github.com/m7ameddib/DentalNova/releases) for `DNT-Dental-Main-Clinic-Setup-v*.exe`.

Updates download to `ProgramData\DibNova\DNTDental\downloads\` and launch the existing Inno Setup installer. Choose **Update Existing Installation** — clinic data at `ProgramData\DibNova\DNTDental\data\clinic.db` is never deleted.

---

## Type checking & build verification

```bash
npm run typecheck    # TypeScript check both workspaces
npm run build        # Production build (both modes use same artifacts)
```

Deployment mode is a **runtime** setting — the same build artifact works for both online and offline.
