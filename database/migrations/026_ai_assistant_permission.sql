-- DNT Dental Clinic Management System
-- Migration 026: AI Assistant permission for doctor and employee roles.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (key, label) VALUES ('ai.assistant.use', 'Use AI Assistant');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('doctor', 'employee') AND p.key = 'ai.assistant.use';
