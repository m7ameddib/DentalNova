-- DNT Dental Clinic Management System
-- Migration 013: Patient Follow-up (Clinical + Financial).
--
-- SAFE / additive migration only — no existing data is deleted or reset.

PRAGMA foreign_keys = ON;

-- Optional clinical follow-up delay on treatment catalog entries.
ALTER TABLE treatment_types ADD COLUMN follow_up_days INTEGER;

CREATE TABLE IF NOT EXISTS follow_ups (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL, -- CLINICAL | FINANCIAL
  status                TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | COMPLETED
  reason                TEXT NOT NULL,
  follow_up_date        TEXT NOT NULL, -- ISO date YYYY-MM-DD
  details               TEXT,
  note                  TEXT,
  patient_treatment_id  INTEGER REFERENCES patient_treatments(id) ON DELETE SET NULL,
  created_by_id         INTEGER REFERENCES users(id),
  completed_at          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_patient ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_type_status ON follow_ups(type, status);

-- One active financial follow-up per patient (SQLite partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_ups_active_financial
  ON follow_ups(patient_id)
  WHERE type = 'FINANCIAL' AND status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS follow_up_history (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  follow_up_id         INTEGER REFERENCES follow_ups(id) ON DELETE SET NULL,
  patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL,
  reason               TEXT NOT NULL,
  result               TEXT,
  note                 TEXT,
  next_follow_up_date  TEXT,
  performed_by_id      INTEGER REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_follow_up_history_patient ON follow_up_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_history_created ON follow_up_history(created_at);

-- ======================================================
-- RBAC: followups.manage (doctor + employee)
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('followups.manage', 'Manage patient follow-ups');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('doctor', 'employee') AND p.key = 'followups.manage';
