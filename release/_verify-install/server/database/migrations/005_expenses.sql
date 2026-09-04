-- DNT Dental Clinic Management System
-- Migration 005: Simple Clinic Expenses (Reports).
--
-- SAFE / additive migration only:
--   * No tables are dropped, no existing rows are deleted.
--   * `appointments.duration_min` already exists since 001_init.sql (default 30)
--     and needs no schema change — existing appointments simply keep their
--     current 30-minute duration.
--   * The `expenses.manage` permission is granted to the existing "doctor"
--     system role only, matching the same pattern used for `settings.manage`
--     in migration 004.

PRAGMA foreign_keys = ON;

-- ======================================================
-- Clinic expenses (simple — not a full accounting system)
-- ======================================================

CREATE TABLE IF NOT EXISTS clinic_expenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,                     -- ISO date (YYYY-MM-DD)
  amount_cents    INTEGER NOT NULL,
  category        TEXT NOT NULL DEFAULT 'OTHER',      -- MATERIALS|LAB|RENT|UTILITIES|MAINTENANCE|OTHER
  payment_method  TEXT NOT NULL DEFAULT 'CASH',        -- reuses payment_methods.code where practical
  note            TEXT,
  created_by_id   INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clinic_expenses_date ON clinic_expenses(date);

-- ======================================================
-- RBAC: expenses.manage (Add / delete clinic expenses)
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('expenses.manage', 'Manage clinic expenses');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'expenses.manage';
