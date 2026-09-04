-- DNT Dental Clinic Management System
-- Migration 012: Employee can add / delete Clinic Expenses.
--
-- SAFE / additive migration only — no data is deleted or reset.
--
-- The Clinic Expenses section on the Reports page is now visible to
-- Employees (migration 011). This migration also grants the existing
-- "expenses.manage" permission (Add / delete clinic expenses) to the
-- "employee" role so the "+ Add expense" action works for them too.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (key, label) VALUES ('expenses.manage', 'Manage clinic expenses');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'employee' AND p.key = 'expenses.manage';
