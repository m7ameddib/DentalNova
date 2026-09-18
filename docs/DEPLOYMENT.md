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
| `GEMINI_API_KEY` | optional | optional | AI assistant. Chat, images, and clinic context go to Google Gemini. If set Online, `AI_SERVICE_SECRET` must be a unique non-default value. Leave empty if you do not need AI yet |
| `AI_SERVICE_URL` | empty unless set | — | Offline AI proxy origin. **Must be set explicitly** to enable; omitting it no longer defaults to production Online |
| `ONLINE_CLINIC_SIGNUP` | — | `open` / `invite` / `disabled` | Production Online defaults to **invite**. Create tokens via DibNova admin `POST /dibnova-admin/signup-invite` |
| `ALLOW_DEMO_USERS` | `1` to seed demo logins | refused when `NODE_ENV=production` | Demo `doctor` / `employee` accounts |
| `R2_ACCOUNT_ID` | optional | optional | Cloudflare R2 account id (Online should set when using object storage) |
| `R2_ACCESS_KEY_ID` | optional | optional | R2 access key — **server-side only**, never sent to the browser |
| `R2_SECRET_ACCESS_KEY` | optional | optional | R2 secret — server-side only |
| `R2_ENDPOINT` | optional | optional | R2 S3 endpoint (defaults to `https://<account>.r2.cloudflarestorage.com`) |
| `R2_BUCKET` | optional | optional | Default `dentalnova-files` |
| `R2_REGION` | optional | optional | Default `auto` |
| `R2_PREFIX` | optional | optional | Optional key prefix inside the bucket |
| `PUBLIC_ONLINE_URL` | — | optional | Public URL returned in pairing payloads |
| `PLATFORM_SECRETS_KEY` | — | **required** in production | Encrypts trial passwords in platform.db. Must be unique and **not** `JWT_SECRET` |
| `DIBNOVA_ADMIN_USERNAME` | optional | **required** | DibNova admin sign-in username |
| `DIBNOVA_ADMIN_PASSWORD` | optional | **required** | DibNova admin sign-in password (server-side only) |
| `DIBNOVA_ADMIN_API_KEY` | — | optional | Automation/scripts only — not used in the browser UI |
| `DIBNOVA_ADMIN_JWT_EXPIRES_IN` | — | optional | Admin session length (default `8h`) |
| `GITHUB_RELEASES_REPO` | optional | — | Offline update source (default: `m7ameddib/DentalNova`) |

See `server/.env.example` (offline) and `deploy/.env.online.example` (online).

### Render / cloud boot: `AI_SERVICE_SECRET`

If the process **exits on start** with a message that `GEMINI_API_KEY` is set but `AI_SERVICE_SECRET` is missing or not unique:

1. **If you do not need the AI assistant yet** — remove `GEMINI_API_KEY` (or leave it empty). The server will boot.
2. **If you want AI** — set `AI_SERVICE_SECRET` to a **unique** value for this deployment. It must not be empty, must not be `DentalNova.AI.Proxy.v1`, and must not be the example placeholder `REPLACE_WITH_UNIQUE_AI_PROXY_SECRET`.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use the same unique secret on Offline Windows installs that proxy AI through this Online server (`AI_SERVICE_URL` + `AI_SERVICE_SECRET`). Leave `AI_SERVICE_URL` empty to disable the Offline AI proxy — it does **not** default to production. Do not weaken or skip this check.

---

## Same-clinic Online ↔ Offline sync

This is **not** the Online browser IndexedDB outbox, and **not** a backup.

1. On the **Online** clinic (Settings → Online ↔ Offline sync) create a pairing code (expires in ~10 minutes).
2. On the **Offline Windows** app enter the Online URL + code. The server issues device credentials stored only in `{DNT_DATA_DIR}/config/sync-device.json`.
3. The Offline app uploads pending change-log rows and pulls deltas since its checkpoint. Device JWTs cannot be used as doctor sessions. Revoke a computer from Online Settings or Disconnect from Offline (best-effort self-revoke).

Initial pairing downloads an Online snapshot into the Offline database. Do **not** pair two already-populated unrelated clinic databases expecting an automatic merge — review conflicts in Settings.

Object files (X-rays, PDFs) sync through the API (`/api/sync/files`), not with client R2 keys. When R2 env vars are set, Online also stores blobs in bucket `dentalnova-files` (keys are prefixed with the clinic id). Offline keeps a local filesystem copy when R2 is unavailable.

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

**Browser UI:** `POST /api/dibnova-admin/auth/login` with `{ "username", "password" }` → use returned JWT as `Authorization: Bearer <token>`. Admin JWTs use a dedicated issuer (`dentalnova-admin`), audience (`dibnova-admin`), purpose (`dibnova_admin`), and derived signing secret — clinic/doctor JWTs cannot access Admin APIs, and Admin JWTs cannot be used as clinic sessions.

**Automation (optional):** header `X-DibNova-Admin-Key: <DIBNOVA_ADMIN_API_KEY>` (minimum 16 characters). Not used by the browser UI.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dibnova-admin/auth/login` | Admin sign-in |
| POST | `/api/dibnova-admin/auth/logout` | End Admin session (revokes JWT `jti`) |
| GET | `/api/dibnova-admin/auth/me` | Current Admin identity |
| GET | `/api/dibnova-admin/installation` | Clinic + subscription/license info |
| GET | `/api/dibnova-admin/clinics` | List/search managed clinics (no stored passwords) |
| POST | `/api/dibnova-admin/subscription/activate` | PENDING → ACTIVE |
| POST | `/api/dibnova-admin/subscription/extend` | Extend active subscription |
| POST | `/api/dibnova-admin/subscription/suspend` | Suspend clinic (`{ "reason": "..." }`) |
| POST | `/api/dibnova-admin/subscription/reactivate` | SUSPENDED/EXPIRED → ACTIVE |
| GET | `/api/dibnova-admin/ops/health` | API / database / storage / R2 / sync status |
| GET | `/api/dibnova-admin/audit` | Admin audit log (no secrets) |

Offline licensing is unchanged — use the existing `tools/dibnova-license-generator` (separate from online subscriptions).

---

## Offline updates (GitHub Releases)

In **offline desktop mode**, open **Settings → Updates** to check [GitHub Releases](https://github.com/m7ameddib/DentalNova/releases) for `DNT-Dental-Main-Clinic-Setup-v*.exe`.

Each release **must** also publish `DNT-Dental-Main-Clinic-Setup-v*.exe.sha256`. The app refuses to install an update that has no checksum sidecar (it does not skip verification). On Windows the installer must also pass Authenticode (`Get-AuthenticodeSignature` Status = Valid). Optional: set `UPDATE_AUTHENTICODE_PUBLISHER` to pin the expected publisher string. `ALLOW_UNSIGNED_UPDATES` is ignored.

Updates download to `ProgramData\DibNova\DNTDental\downloads\` and launch the existing Inno Setup installer. Choose **Update Existing Installation** — clinic data at `ProgramData\DibNova\DNTDental\data\clinic.db` is never deleted.

The updater only accepts an installer whose filename matches the GitHub release tag (`DNT-Dental-Main-Clinic-Setup-v{tag}.exe`). A leftover EXE for a different version on the same release is ignored. `ALLOW_UNSIGNED_UPDATES` is ignored; Windows launch always requires Authenticode Status = Valid. PowerShell Authenticode inspection times out after 30 seconds and is treated as untrusted.

### Authenticode (external — not in this repository)

This environment cannot buy or install a code-signing certificate. Before selling Offline Windows:

1. Obtain an Authenticode certificate (EV preferred) in the DibNova / publisher name.
2. Sign `DNT-Dental-Main-Clinic-Setup-v*.exe` before attaching it to the GitHub Release.
3. Publish the matching `.exe.sha256` sidecar.
4. Set `UPDATE_AUTHENTICODE_PUBLISHER` on clinic PCs once you know the signed Subject string.

Until those exist, the updater **correctly refuses** unsigned EXEs on Windows. That is a release-ops blocker, not an application-logic hole.

### Live Windows clinic drill (must be run on a real PC — not claimed here)

This Linux/cloud agent cannot run a headed Windows pairing drill. Before the first paying clinic, an operator should:

1. Fresh Offline install on Windows (empty `clinic.db`).
2. Activate with a **signed** license (not a hand-edited `license_payload`).
3. Complete first setup; create a patient on Online only.
4. Pair: Online creates a code → Offline Settings → Connect to Online → confirm clinic name/ID → first snapshot finishes (`bootstrapped_at` set) **before** anyone books locally.
5. Add a treatment + payment on Offline, wait for auto-sync, confirm the same rows on Online.
6. Settings → Updates: download a signed release, confirm SHA-256 + Authenticode, Update Existing Installation, reopen, data intact.
7. Backup → restore on the same clinic; confirm patients return.
8. Negative: a populated Offline must be blocked from pairing.

### Rate limits

Login, pairing, licensing, and admin API-key limits persist in `{DNT_DATA_DIR}/config/shared-durable.db` (SQLite WAL). Multiple Online app processes that share the same data volume see the same counters. JSON files from earlier builds are imported once. There is no Redis in this stack.

### Pairing empty-clinic attestation and device trust

Online `/api/sync/pairing/complete` requires protocol **v3**: `emptyClinic: true`, a zero census, an HMAC-SHA256 proof **keyed by the pairing challenge** (not the 8-character code), a DibNova-signed Offline **license** bound to the presented `installationId`, an Ed25519 **device public key**, and a `pairingSignature` over that transcript. Official Offline generates the keypair locally, fills the census from SQLite, and presents its activated license.

A custom HTTP client that only has a pairing code cannot complete pairing. After pairing, key-bound devices must sign token and sync requests (`x-dentalnova-device-ts` / `x-dentalnova-device-sig`). Online still refuses operational PUSH and file uploads until the device has walked the snapshot from the start (`bootstrap_completed_at`). Existing devices with `pull_checkpoint > 0` are backfilled as already bootstrapped. Existing devices without a public key keep using `deviceSecret` until official Offline registers a key (`POST /api/sync/device/register-key`).

A modified client that already possesses a **valid stolen/purchased license** can still generate its own device key and attest zeros — Online cannot inspect the Offline disk, and this stack has no Windows TPM / Authenticode remote attestation. Residual risk is a licensed unofficial client, not pairing-code-only scripts.

---

## Type checking & build verification

```bash
npm run typecheck    # TypeScript check both workspaces
npm run build        # Production build (both modes use same artifacts)
```

Deployment mode is a **runtime** setting — the same build artifact works for both online and offline.
