-- DNT Dental Clinic Management System
-- Migration 006: adds the "patients.delete" permission, granted to the
-- existing "doctor" system role only (same pattern as "expenses.manage" in
-- migration 005). Safe / additive only — no data is deleted by this migration.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (key, label) VALUES ('patients.delete', 'Delete patients');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'patients.delete';
