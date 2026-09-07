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
cp deploy/.env.online.example .env   # set JWT_SECRET first
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
│       ├── payments/       # Patient payments
│       └── sync/           # Placeholder interface for future online synchronization
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
the local SQLite file (persistence). Swapping any layer later — e.g.
pointing the client at a remote host, or adding a real sync provider that
implements `server/src/sync/sync.interface.ts` — does not require touching
the other layers.

## Offline-first, online-ready

Everything runs locally: the API listens on `localhost` and stores data in
a single SQLite file (`server/data/clinic.db`, created automatically). No
internet connection is required for normal clinic work. Every syncable
table (`patients`, `appointments`, `patient_treatments`, `payments`) already
carries a `sync_status` + `updated_at` column so a future sync
implementation can diff local vs. remote state without a schema change.

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

# seed default roles, permissions, treatment types and two demo logins
npm run seed

# start the API (http://localhost:4000/api)
npm run dev:server

# in a second terminal, start the desktop UI (http://localhost:5173)
npm run dev:client
```

Demo logins (created by `npm run seed`):

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
advanced inventory, laboratory management, complex reports, WhatsApp API
automation, and real cloud synchronization.
