-- Safe completion if migration 020 was interrupted before source_lab_payment_id / RBAC.
-- No-op when repair-migration-020.js already ran.

PRAGMA foreign_keys = ON;

-- Permissions (idempotent)
INSERT OR IGNORE INTO permissions (key, label) VALUES ('appointments.book_outside_hours', 'Book appointments outside working hours');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.record', 'Record lab case payments');
INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.void', 'Void lab case payments');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key IN ('appointments.book_outside_hours', 'lab.payments.record', 'lab.payments.void');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'employee' AND p.key = 'lab.payments.record';
