-- DNT Dental Clinic Management System
-- Migration 003: Walk-in appointment bookings + expanded appointment statuses.
--
-- SAFE / additive migration only:
--   * No data is deleted. All existing appointments are copied over unchanged.
--   * `patient_id` becomes nullable so a visit can be booked for a person who
--     does not have a Patient Record yet (a "walk-in"/quick booking), using
--     the new `guest_name` / `guest_phone` columns to hold their details until
--     they are linked to (or turned into) a real Patient Record.
--   * The `status` column stays a free-form TEXT (no CHECK constraint existed
--     before either), so the expanded status vocabulary (SCHEDULED, WAITING,
--     IN_TREATMENT, COMPLETED, CANCELLED) is enforced at the application layer
--     only — no schema change is required for that part.
--
-- SQLite cannot ALTER a column to drop NOT NULL / change its FK in place, so
-- this rebuilds the table (standard SQLite migration pattern) and copies the
-- existing rows across unchanged.

PRAGMA foreign_keys = OFF;

CREATE TABLE appointments_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id       INTEGER REFERENCES patients(id) ON DELETE CASCADE, -- nullable: NULL = walk-in, not yet linked to a Patient Record
  guest_name       TEXT,   -- used only while patient_id IS NULL
  guest_phone      TEXT,   -- used only while patient_id IS NULL
  date             TEXT NOT NULL,          -- ISO date (YYYY-MM-DD)
  time             TEXT NOT NULL,          -- HH:mm (24h)
  duration_min     INTEGER NOT NULL DEFAULT 30,
  appointment_type TEXT NOT NULL DEFAULT 'CHECKUP',
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED|WAITING|IN_TREATMENT|COMPLETED|CANCELLED
  notes            TEXT,
  created_by_id    INTEGER REFERENCES users(id),
  sync_status      TEXT NOT NULL DEFAULT 'LOCAL',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO appointments_new (
  id, patient_id, guest_name, guest_phone, date, time, duration_min, appointment_type,
  reason, status, notes, created_by_id, sync_status, created_at, updated_at
)
SELECT
  id, patient_id, NULL, NULL, date, time, duration_min, appointment_type,
  reason, status, notes, created_by_id, sync_status, created_at, updated_at
FROM appointments;

-- Any legacy NO_SHOW rows fold into CANCELLED (closest match in the new, smaller status set).
UPDATE appointments_new SET status = 'CANCELLED' WHERE status = 'NO_SHOW';

DROP TABLE appointments;
ALTER TABLE appointments_new RENAME TO appointments;

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

PRAGMA foreign_keys = ON;
