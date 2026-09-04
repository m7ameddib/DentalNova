-- DNT Dental Clinic Management System
-- Migration 011: Employee can view the Reports page, except Financial Summary.
--
-- SAFE / additive migration only — no data is deleted or reset.
--
-- The Reports page is split into two permission levels:
--   * "reports.view"          -> general access to the Reports page itself,
--                                the Appointments Summary and Patients
--                                Summary sections/drill-downs, and viewing
--                                the Clinic Expenses list. Granted to both
--                                "doctor" and "employee".
--   * "reports.financial.view" -> the Financial Summary section (treatment
--                                value, discounts, collected, outstanding,
--                                expenses total, net cash) and its
--                                treatment/payment/outstanding drill-downs.
--                                Stays doctor-only (see migration 008).
--
-- This migration only grants the pre-existing "reports.view" permission to
-- both system roles; it does not touch "reports.financial.view".

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (key, label) VALUES ('reports.view', 'View reports');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('doctor', 'employee') AND p.key = 'reports.view';
