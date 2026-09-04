-- DNT Dental Clinic Management System
-- Migration 004: Settings (clinic info / working hours / WhatsApp reminder config),
-- editable Payment Methods, and Patient Attachments (X-rays / photos / documents).
--
-- SAFE / additive migration only:
--   * No tables are dropped, no existing rows are deleted.
--   * `payments.method` stays a free-text column (unchanged) — it is no longer
--     restricted to a hardcoded enum at the database layer. Existing payment
--     rows keep displaying exactly as before; their method codes are backfilled
--     into the new `payment_methods` table below so they remain visible/editable
--     from Settings instead of disappearing from the admin UI.
--   * The `settings.manage` permission is granted to the existing "doctor"
--     system role only (data-only, no destructive change), matching the same
--     pattern used for `treatments.manage` in migration 002.

PRAGMA foreign_keys = ON;

-- ======================================================
-- Payment methods (editable list; "Cash" is the default)
-- ======================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO payment_methods (code, label, sort_order) VALUES ('CASH', 'Cash', 1);

-- Backfill: any payment method code already used historically (e.g. demo/test
-- data recorded before this migration) stays manageable instead of vanishing.
INSERT OR IGNORE INTO payment_methods (code, label, sort_order)
SELECT DISTINCT p.method, p.method, 99
FROM payments p
WHERE p.method IS NOT NULL AND TRIM(p.method) != '';

-- ======================================================
-- Clinic settings (single configuration row, id = 1)
-- ======================================================

CREATE TABLE IF NOT EXISTS clinic_settings (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  clinic_name            TEXT,
  clinic_phone           TEXT,
  address                TEXT,
  logo_path              TEXT,
  logo_original_name     TEXT,
  working_days           TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6', -- CSV, 0=Sunday .. 6=Saturday
  work_start_time        TEXT NOT NULL DEFAULT '09:00',
  work_end_time          TEXT NOT NULL DEFAULT '18:00',
  reminders_enabled      INTEGER NOT NULL DEFAULT 0,
  reminder_hours_before  INTEGER NOT NULL DEFAULT 24,
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Defaults mirror the previous hardcoded clinic hours (09:00-18:00, every day)
-- so existing appointment-booking behaviour does not change until an admin
-- explicitly configures Working Hours in Settings.
INSERT OR IGNORE INTO clinic_settings (id, work_start_time, work_end_time)
VALUES (1, '09:00', '18:00');

-- ======================================================
-- Patient attachments (X-rays / photos / documents)
-- Files live on disk under server/data/uploads/patients/<patient_id>/ —
-- only metadata + relative path is stored here (never file contents).
-- ======================================================

CREATE TABLE IF NOT EXISTS patient_attachments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  original_file_name  TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'OTHER', -- XRAY | PHOTO | DOCUMENT | OTHER
  stored_path         TEXT NOT NULL,                 -- relative to server/data/uploads
  mime_type           TEXT,
  file_size           INTEGER,
  note                TEXT,
  uploaded_by_id      INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_attachments_patient ON patient_attachments(patient_id);

-- ======================================================
-- RBAC: settings.manage (Clinic Info / Payment Methods / Working Hours / WhatsApp config)
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('settings.manage', 'Manage clinic settings');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'settings.manage';
