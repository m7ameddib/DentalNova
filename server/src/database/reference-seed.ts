import Database from 'better-sqlite3';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '../common/rbac.constants';
import { DEFAULT_TREATMENT_TYPES } from '../common/treatment-types.constants';

/** Idempotent reference data required for a fresh clinic install (no demo users). */
export function seedReferenceData(db: Database.Database): void {
  ensureRolesAndPermissions(db);
  seedTreatmentTypes(db);
}

/**
 * Grants any missing default permissions to the built-in doctor/employee roles.
 * Safe to run on every startup (INSERT OR IGNORE) so Update and New Install
 * both pick up features such as AI Assistant without requiring a logout-only workaround.
 */
export function ensureRolesAndPermissions(db: Database.Database): void {
  const allKeys = new Set<string>();
  for (const role of DEFAULT_ROLES) role.permissions.forEach((p) => allKeys.add(p));

  const labelByKey = new Map(ALL_PERMISSIONS.map((p) => [p.key, p.label]));
  const insertPermission = db.prepare(
    'INSERT OR IGNORE INTO permissions (key, label) VALUES (?, ?)',
  );
  for (const key of allKeys) {
    insertPermission.run(key, labelByKey.get(key) ?? key);
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
      const permRow = getPermissionId.get(permKey) as { id: number } | undefined;
      if (!permRow) continue;
      linkRolePermission.run(roleRow.id, permRow.id);
    }
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
  const backfill = db.prepare(
    `UPDATE treatment_types SET default_price_cents = ? WHERE code = ? AND default_price_cents = 0`,
  );
  for (const t of DEFAULT_TREATMENT_TYPES) {
    backfill.run(t.defaultPriceCents, t.code);
  }
}
