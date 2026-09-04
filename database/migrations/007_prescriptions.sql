-- DNT Dental Clinic Management System
-- Migration 007: Simple Prescriptions (Patient Workspace, doctor-only).
--
-- SAFE / additive migration only:
--   * No tables are dropped, no existing rows are deleted.
--   * Prescriptions belong to a patient (cascade-deleted with the patient,
--     same pattern as patient_treatments / payments / patient_attachments)
--     and optionally reference the doctor who wrote them.
--   * The "prescriptions.manage" permission is granted to the existing
--     "doctor" system role only — Employees have no access to prescriptions
--     (create, view, edit, delete, or print), matching the same pattern used
--     for "expenses.manage" in migration 005.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prescriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS prescription_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id  INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name    TEXT NOT NULL,
  dose             TEXT,
  frequency        TEXT,
  duration         TEXT,
  instructions     TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);

-- ======================================================
-- RBAC: prescriptions.manage (doctor only)
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('prescriptions.manage', 'Manage prescriptions');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'prescriptions.manage';
