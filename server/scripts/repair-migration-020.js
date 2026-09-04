/**
 * Completes migration 020 if it was interrupted (safe to run multiple times).
 * Does NOT delete or reset clinic data.
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'clinic.db');
const db = new Database(dbPath);

const applied = new Set(
  db.prepare('SELECT name FROM _migrations').all().map((r) => r.name),
);

if (applied.has('020_working_hours_lab_payments.sql')) {
  console.log('Migration 020 already recorded — nothing to repair.');
  process.exit(0);
}

const expenseCols = db.prepare('PRAGMA table_info(clinic_expenses)').all().map((c) => c.name);

db.exec('PRAGMA foreign_keys = ON');

if (!expenseCols.includes('source_lab_payment_id')) {
  db.exec(`ALTER TABLE clinic_expenses ADD COLUMN source_lab_payment_id INTEGER REFERENCES lab_case_payments(id)`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_expenses_source_lab_payment ON clinic_expenses(source_lab_payment_id) WHERE source_lab_payment_id IS NOT NULL`,
  );
  console.log('Added clinic_expenses.source_lab_payment_id');
}

db.exec(`
  INSERT OR IGNORE INTO permissions (key, label) VALUES ('appointments.book_outside_hours', 'Book appointments outside working hours');
  INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.record', 'Record lab case payments');
  INSERT OR IGNORE INTO permissions (key, label) VALUES ('lab.payments.void', 'Void lab case payments');

  INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'doctor' AND p.key IN ('appointments.book_outside_hours', 'lab.payments.record', 'lab.payments.void');

  INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'employee' AND p.key = 'lab.payments.record';
`);

db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('020_working_hours_lab_payments.sql');
console.log('Marked migration 020 as applied.');
