-- DNT Dental Clinic Management System
-- Initial schema (SQLite). This file is the single source of truth for the
-- local data model. It is applied automatically by the server on startup
-- (see server/src/database/database.service.ts).
--
-- Design notes:
--   * Roles/Permissions are data-driven (RBAC), not hardcoded to Doctor/Employee.
--   * Every "working" table carries a syncStatus + updatedAt so a future sync
--     layer can diff local vs. remote state without schema changes.
--   * Money is stored in minor units (cents) as INTEGER to avoid float drift.

PRAGMA foreign_keys = ON;

-- ======================================================
-- RBAC
-- ======================================================

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,        -- e.g. "doctor", "employee" (extensible)
  label       TEXT NOT NULL,               -- display label / i18n key fallback
  is_system   INTEGER NOT NULL DEFAULT 0,  -- system roles cannot be deleted
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,        -- e.g. "patients.create"
  label       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ======================================================
-- PATIENTS / FAMILY
-- ======================================================

CREATE TABLE IF NOT EXISTS family_groups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_phone  TEXT,
  label          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  file_number      TEXT NOT NULL UNIQUE,   -- auto-generated, e.g. P-000001
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  gender           TEXT,                   -- MALE | FEMALE | OTHER
  date_of_birth    TEXT,                   -- ISO date, nullable
  approx_age       INTEGER,                -- used when DOB unknown
  address          TEXT,
  medical_notes    TEXT,
  general_notes    TEXT,
  family_group_id  INTEGER REFERENCES family_groups(id),
  sync_status      TEXT NOT NULL DEFAULT 'LOCAL',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);

CREATE TABLE IF NOT EXISTS medical_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ======================================================
-- APPOINTMENTS
-- ======================================================

CREATE TABLE IF NOT EXISTS appointments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,          -- ISO date (YYYY-MM-DD)
  time             TEXT NOT NULL,          -- HH:mm (24h)
  duration_min     INTEGER NOT NULL DEFAULT 30,
  appointment_type TEXT NOT NULL DEFAULT 'CHECKUP',
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED|COMPLETED|CANCELLED|NO_SHOW
  notes            TEXT,
  created_by_id    INTEGER REFERENCES users(id),
  sync_status      TEXT NOT NULL DEFAULT 'LOCAL',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- ======================================================
-- TREATMENTS
-- ======================================================

CREATE TABLE IF NOT EXISTS treatment_types (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,      -- FILLING, ROOT_CANAL, CROWN, ...
  abbreviation  TEXT NOT NULL,             -- F, RCT, CR, EX ...
  label         TEXT NOT NULL,             -- fallback label / i18n key
  color_hex     TEXT NOT NULL DEFAULT '#2563EB',
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patient_treatments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id         INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_type_id  INTEGER NOT NULL REFERENCES treatment_types(id),
  tooth_number       INTEGER,              -- FDI numbering, nullable for whole-mouth treatments
  price_cents        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED|IN_PROGRESS|COMPLETED
  note               TEXT,
  doctor_id          INTEGER REFERENCES users(id),
  sync_status        TEXT NOT NULL DEFAULT 'LOCAL',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_treatments_patient ON patient_treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_tooth ON patient_treatments(patient_id, tooth_number);

-- ======================================================
-- PAYMENTS / ACCOUNT
-- ======================================================

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  amount_cents   INTEGER NOT NULL,
  method         TEXT NOT NULL DEFAULT 'CASH', -- CASH|CARD|BANK_TRANSFER|OTHER
  date           TEXT NOT NULL,            -- ISO date
  note           TEXT,
  recorded_by_id INTEGER REFERENCES users(id),
  sync_status    TEXT NOT NULL DEFAULT 'LOCAL',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
