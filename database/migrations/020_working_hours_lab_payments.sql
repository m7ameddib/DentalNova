-- Advanced working hours + lab case payments — additive migration.

PRAGMA foreign_keys = ON;

-- ======================================================
-- Weekly working periods (per weekday, multiple periods)
-- ======================================================

CREATE TABLE IF NOT EXISTS clinic_weekly_periods (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clinic_weekly_periods_day ON clinic_weekly_periods(day_of_week);

-- Seed from legacy clinic_settings if table is empty
INSERT INTO clinic_weekly_periods (day_of_week, start_time, end_time, sort_order)
SELECT d.day, cs.work_start_time, cs.work_end_time, 0
FROM clinic_settings cs
CROSS JOIN (
  SELECT 0 AS day UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
  UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) d
WHERE cs.id = 1
  AND NOT EXISTS (SELECT 1 FROM clinic_weekly_periods LIMIT 1)
  AND (',' || cs.working_days || ',') LIKE '%,' || d.day || ',%';

-- ======================================================
-- Date schedule exceptions
-- ======================================================

CREATE TABLE IF NOT EXISTS clinic_schedule_exceptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_date  TEXT NOT NULL UNIQUE,
  is_closed       INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clinic_exception_periods (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_id    INTEGER NOT NULL REFERENCES clinic_schedule_exceptions(id) ON DELETE CASCADE,
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clinic_schedule_exceptions_date ON clinic_schedule_exceptions(exception_date);

-- ======================================================
-- Lab case cost + payments
-- ======================================================

ALTER TABLE lab_cases ADD COLUMN lab_cost_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS lab_case_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_case_id       INTEGER NOT NULL REFERENCES lab_cases(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  payment_method    TEXT NOT NULL,
  payment_date      TEXT NOT NULL,
  note              TEXT,
  expense_id        INTEGER UNIQUE REFERENCES clinic_expenses(id),
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  voided_at         TEXT,
  voided_by_id      INTEGER REFERENCES users(id),
  void_reason       TEXT,
  recorded_by_id    INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lab_case_payments_case ON lab_case_payments(lab_case_id);

-- Expense void + lab payment link (prevent duplicate expenses)
ALTER TABLE clinic_expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE clinic_expenses ADD COLUMN voided_at TEXT;
ALTER TABLE clinic_expenses ADD COLUMN voided_by_id INTEGER REFERENCES users(id);
ALTER TABLE clinic_expenses ADD COLUMN void_reason TEXT;
ALTER TABLE clinic_expenses ADD COLUMN source_lab_payment_id INTEGER REFERENCES lab_case_payments(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_expenses_source_lab_payment ON clinic_expenses(source_lab_payment_id) WHERE source_lab_payment_id IS NOT NULL;

-- ======================================================
-- RBAC
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('appointments.book_outside_hours', 'Book appointments outside working hours');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.record', 'Record lab case payments');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.void', 'Void lab case payments');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key IN ('appointments.book_outside_hours', 'lab.payments.record', 'lab.payments.void');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'employee' AND p.key = 'lab.payments.record';
