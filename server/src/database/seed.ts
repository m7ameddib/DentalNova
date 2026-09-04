/* eslint-disable no-console */
import Database from 'better-sqlite3';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DEFAULT_ROLES } from '../common/rbac.constants';
import { DEFAULT_TREATMENT_TYPES } from '../common/treatment-types.constants';

dotenv.config();

/**
 * Idempotent seed script: run with `npm run seed --workspace=server`.
 * Applies migrations (if not already applied via app startup) and inserts
 * default roles/permissions, treatment types, and one demo login per role.
 */
function main() {
  const dbFile = process.env.DATABASE_FILE || './data/clinic.db';
  const resolved = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma('foreign_keys = ON');

  applyMigrations(db);
  seedRolesAndPermissions(db);
  seedTreatmentTypes(db);
  seedDemoUsers(db);

  db.close();
  console.log('Seed complete.');
}

function applyMigrations(db: Database.Database) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
  const migrationsDir = path.join(process.cwd(), '..', 'database', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`Applied migration ${file}`);
  }
}

function seedRolesAndPermissions(db: Database.Database) {
  const allKeys = new Set<string>();
  for (const role of DEFAULT_ROLES) role.permissions.forEach((p) => allKeys.add(p));

  const insertPermission = db.prepare(
    'INSERT OR IGNORE INTO permissions (key, label) VALUES (?, ?)',
  );
  for (const key of allKeys) {
    insertPermission.run(key, key);
  }

  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (name, label, is_system) VALUES (?, ?, ?)',
  );
  const getRoleId = db.prepare('SELECT id FROM roles WHERE name = ?');
  const getPermissionId = db.prepare('SELECT id FROM permissions WHERE key = ?');
  const linkRolePermission = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
  );

  for (const role of DEFAULT_ROLES) {
    insertRole.run(role.name, role.label, role.isSystem ? 1 : 0);
    const roleRow = getRoleId.get(role.name) as { id: number };
    for (const permKey of role.permissions) {
      const permRow = getPermissionId.get(permKey) as { id: number };
      linkRolePermission.run(roleRow.id, permRow.id);
    }
    console.log(`Seeded role: ${role.name}`);
  }
}

function seedTreatmentTypes(db: Database.Database) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO treatment_types (code, abbreviation, label, color_hex, sort_order, default_price_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const t of DEFAULT_TREATMENT_TYPES) {
    insert.run(t.code, t.abbreviation, t.label, t.colorHex, t.sortOrder, t.defaultPriceCents);
  }
  // Backfill price for types that already existed before this field was
  // introduced (safe no-op on fresh installs where the row was just inserted
  // with the correct price above).
  const backfill = db.prepare(
    `UPDATE treatment_types SET default_price_cents = ? WHERE code = ? AND default_price_cents = 0`,
  );
  for (const t of DEFAULT_TREATMENT_TYPES) {
    backfill.run(t.defaultPriceCents, t.code);
  }
  console.log(`Seeded ${DEFAULT_TREATMENT_TYPES.length} treatment types`);
}

function seedDemoUsers(db: Database.Database) {
  const getRoleId = db.prepare('SELECT id FROM roles WHERE name = ?');
  const getUser = db.prepare('SELECT id FROM users WHERE username = ?');
  const insertUser = db.prepare(
    `INSERT INTO users (full_name, username, password_hash, role_id) VALUES (?, ?, ?, ?)`,
  );

  const demoUsers = [
    { fullName: 'Dr. Admin', username: 'doctor', password: 'doctor123', role: 'doctor' },
    { fullName: 'Front Desk', username: 'employee', password: 'employee123', role: 'employee' },
  ];

  for (const u of demoUsers) {
    if (getUser.get(u.username)) {
      console.log(`User already exists: ${u.username}`);
      continue;
    }
    const roleRow = getRoleId.get(u.role) as { id: number };
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(u.fullName, u.username, hash, roleRow.id);
    console.log(`Created demo user: ${u.username} / ${u.password}`);
  }
}

main();
