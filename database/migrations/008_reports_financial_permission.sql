-- DNT Dental Clinic Management System
-- Migration 008: Dedicated "reports.financial.view" permission.
--
-- SAFE / additive migration only — no data is deleted or reset.
--
-- The Reports page (financial summary, treatment/discount/payment/
-- outstanding drill-downs, and Clinic Expenses) is financial in nature.
-- This migration introduces an explicit permission for it and grants it to
-- the existing "doctor" system role only, so Employees cannot access
-- Financial Reports or their financial details, independent of the older
-- "reports.view" key.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (key, label) VALUES ('reports.financial.view', 'View financial reports');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'reports.financial.view';
