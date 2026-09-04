-- Doctor clinical improvements — additive migration (preserves all existing clinic data).

PRAGMA foreign_keys = ON;

-- ======================================================
-- Medical alerts (separate from medical_notes text field)
-- ======================================================

CREATE TABLE IF NOT EXISTS medical_alerts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_type          TEXT NOT NULL,
  label               TEXT NOT NULL,
  note                TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_by_id       INTEGER REFERENCES users(id),
  deactivated_at      TEXT,
  deactivated_by_id   INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medical_alerts_patient ON medical_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_alerts_active ON medical_alerts(patient_id, is_active);

-- ======================================================
-- Clinical visit notes
-- ======================================================

CREATE TABLE IF NOT EXISTS clinical_visit_notes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id            INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_date            TEXT NOT NULL,
  chief_complaint       TEXT,
  examination_findings  TEXT,
  diagnosis             TEXT,
  procedure_action      TEXT,
  anesthesia_note       TEXT,
  clinical_notes        TEXT,
  patient_instructions  TEXT,
  created_by_id         INTEGER REFERENCES users(id),
  updated_by_id         INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clinical_visit_notes_patient ON clinical_visit_notes(patient_id);

-- ======================================================
-- Activity / audit log
-- ======================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     INTEGER,
  patient_id    INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  user_id       INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_patient ON audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ======================================================
-- Payment void (soft void — never delete from UI)
-- ======================================================

ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE payments ADD COLUMN voided_at TEXT;
ALTER TABLE payments ADD COLUMN voided_by_id INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN void_reason TEXT;

-- ======================================================
-- Treatment completion metadata
-- ======================================================

ALTER TABLE patient_treatments ADD COLUMN completed_at TEXT;
ALTER TABLE patient_treatments ADD COLUMN completed_by_id INTEGER REFERENCES users(id);

-- ======================================================
-- Attachment links (optional tooth / treatment / visit)
-- ======================================================

ALTER TABLE patient_attachments ADD COLUMN patient_treatment_id INTEGER REFERENCES patient_treatments(id) ON DELETE SET NULL;
ALTER TABLE patient_attachments ADD COLUMN clinical_visit_note_id INTEGER REFERENCES clinical_visit_notes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS patient_attachment_teeth (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_id   INTEGER NOT NULL REFERENCES patient_attachments(id) ON DELETE CASCADE,
  tooth_number    INTEGER NOT NULL,
  UNIQUE(attachment_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_patient_attachment_teeth_attachment ON patient_attachment_teeth(attachment_id);

-- ======================================================
-- RBAC: clinical + audit permissions
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('medical.alerts.manage', 'Manage medical alerts');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('clinical.notes.manage', 'Manage clinical visit notes');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('audit.view', 'View activity audit log');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('payments.void', 'Void payments');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key IN ('medical.alerts.manage', 'clinical.notes.manage', 'audit.view', 'payments.void');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'employee' AND p.key IN ('medical.alerts.manage', 'clinical.notes.manage');
