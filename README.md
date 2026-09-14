# DNT Dental — Clinic Management System

Unified **online** (cloud browser) and **offline** (Windows desktop) dental clinic management system in a single codebase.

## Deployment modes

| Mode | Use case | Docs |
|------|----------|------|
| **Online** | Browser at `https://dentalnova.dibnova.com`, cloud Docker deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#online-deployment-production) |
| **Offline** | Windows desktop installer, no internet required, local SQLite | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#offline-deployment-windows-installer) |

Quick commands:

```bash
# Development
npm install
npm run dev:server          # offline mode (default)
npm run dev:client

# Online production (Docker)
cp deploy/.env.online.example .env   # set JWT_SECRET (and unique AI_SERVICE_SECRET if GEMINI_API_KEY is set)
npm run docker:up

# Offline Windows installer
npm run release:offline
```

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for full build, deploy, and configuration details.

## Architecture

```
DNT-project/
├── database/            # Single source of truth for the local data model
│   └── migrations/       # Plain SQL migrations, applied automatically on server start
├── server/               # NestJS API (business logic + data access + persistence)
│   └── src/
│       ├── database/      # DatabaseService (SQLite connection + migrations) + repositories
│       ├── auth/           # JWT auth, RBAC guards/decorators
│       ├── users/          # Users & roles (admin-facing)
│       ├── patients/       # Patients, family linking, account/appointment summaries
│       ├── appointments/   # Day schedule + booking
│       ├── treatments/     # Treatment type catalog + patient treatments
│               ├── payments/       # Patient payments
│       └── sync/           # Same-clinic Online ↔ Offline change-sync (pairing + device auth)
└── client/               # React + Vite desktop UI
    └── src/
        ├── api/            # Thin HTTP client modules (the only layer allowed to call the API)
        ├── i18n/           # en/ar translations, RTL/LTR handling
        ├── store/          # Zustand stores (auth session, language)
        ├── components/     # Shared UI + the Patient Record's 4 sections
        └── pages/          # Route-level screens
```

**Why this split:** UI (client) never touches the database. It calls typed
API modules, which call the NestJS controllers, which delegate to services
(business logic), which use repositories (data access) to run SQL against
the local SQLite file (persistence). Online browser temporary offline
fallback (`client/src/offline`) is separate from Offline Windows pairing
sync (`server/src/sync`).

## Offline-first, plus same-clinic Online ↔ Offline sync

Everything runs locally: the API listens on `localhost` and stores data in
a SQLite file (`server/data/clinic.db`, created automatically). No
internet connection is required for normal Offline clinic work.

Three distinct mechanisms:

1. **Online browser fallback** — if the cloud API is briefly unreachable, the browser queues essential writes in IndexedDB and replays them. This is not clinic-to-clinic sync.
2. **Offline Windows app** — full local Nest + SQLite clinic database.
3. **Paired change-sync** — Settings → *Online ↔ Offline sync* issues a short-lived pairing code on Online; the Offline app enters that code. Device credentials are stored in `{dataRoot}/config/sync-device.json` (never in the installer). Changes (patients, treatments, payments, appointments, etc.) flow both ways with stable record UIDs, idempotency, and human review for financial/clinical conflicts.

**Sync is not a backup.** Keep Backup & Restore (and USB copies) independent. Pairing never copies `clinic.db` as a whole and never embeds a permanent server secret in the Offline binary.

## RBAC

Roles and permissions are data-driven (see `database/migrations/001_init.sql`
and `server/src/common/rbac.constants.ts`), not hardcoded. Two roles are
seeded initially — **Doctor** (all permissions) and **Employee** (day-to-day
front-desk permissions) — but new roles/permissions can be added purely via
data (see `POST /api/users` and the `roles`/`permissions` tables).

## Getting started

```bash
# from the repository root
npm install

# create the server env file (defaults already work without this)
copy server\.env.example server\.env

# seed default roles, permissions, treatment types
# demo logins require ALLOW_DEMO_USERS=1 (never in production Online)
ALLOW_DEMO_USERS=1 npm run seed

# start the API (http://localhost:4000/api)
npm run dev:server

# in a second terminal, start the desktop UI (http://localhost:5173)
npm run dev:client
```

Demo logins (only when seeded with `ALLOW_DEMO_USERS=1`; never in production Online):

| Username | Password    | Role     |
| -------- | ----------- | -------- |
| doctor   | doctor123   | Doctor   |
| employee | employee123 | Employee |

## Scope of this phase

Implemented: base architecture, EN/AR i18n with RTL, JWT auth + RBAC
foundation, the main desktop shell (top nav, search, language switch,
current user), patients (search, create, duplicate-phone/family linking),
the approved 4-column Patient Record screen, the permanent FDI dental
chart with treatment codes, the treatment add flow, a single-calendar
appointments page, and the patient account/payments foundation.

Intentionally **not** implemented yet (architecture is prepared for them):
advanced inventory, WhatsApp API automation. Same-clinic Online ↔ Offline
change-sync is implemented (pairing + device credentials + conflict review);
it is not a substitute for backups or a multi-clinic mesh.
