-- Dental lab cases — additive migration (preserves all existing clinic data).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lab_names (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_work_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_cases (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id              INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_treatment_id      INTEGER REFERENCES patient_treatments(id) ON DELETE SET NULL,
  lab_name                TEXT NOT NULL,
  work_type_code          TEXT NOT NULL,
  work_type_custom        TEXT,
  status                  TEXT NOT NULL DEFAULT 'PENDING',
  sent_date               TEXT,
  expected_delivery_date  TEXT,
  received_date           TEXT,
  delivered_date          TEXT,
  notes                   TEXT,
  created_by_id           INTEGER REFERENCES users(id),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_case_teeth (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_case_id   INTEGER NOT NULL REFERENCES lab_cases(id) ON DELETE CASCADE,
  tooth_number  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_case_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_case_id     INTEGER NOT NULL REFERENCES lab_cases(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  from_status     TEXT,
  to_status       TEXT,
  note            TEXT,
  performed_by_id INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lab_cases_patient ON lab_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_cases_status ON lab_cases(status);
CREATE INDEX IF NOT EXISTS idx_lab_cases_expected ON lab_cases(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_lab_case_teeth_case ON lab_case_teeth(lab_case_id);

INSERT OR IGNORE INTO lab_work_types (code, label, sort_order) VALUES
  ('CROWN', 'Crown', 1),
  ('BRIDGE', 'Bridge', 2),
  ('DENTURE', 'Denture', 3),
  ('PARTIAL_DENTURE', 'Partial Denture', 4),
  ('VENEER', 'Veneer', 5),
  ('IMPLANT_CROWN', 'Implant Crown', 6),
  ('ORTHODONTIC_APPLIANCE', 'Orthodontic Appliance', 7),
  ('NIGHT_GUARD', 'Night Guard', 8),
  ('RETAINER', 'Retainer', 9),
  ('OTHER', 'Other', 99);

INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.cases.manage', 'Manage dental lab cases');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('doctor', 'employee') AND p.key = 'lab.cases.manage';
