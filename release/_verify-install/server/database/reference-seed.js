"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedReferenceData = seedReferenceData;
const rbac_constants_1 = require("../common/rbac.constants");
const treatment_types_constants_1 = require("../common/treatment-types.constants");
function seedReferenceData(db) {
    seedRolesAndPermissions(db);
    seedTreatmentTypes(db);
}
function seedRolesAndPermissions(db) {
    const allKeys = new Set();
    for (const role of rbac_constants_1.DEFAULT_ROLES)
        role.permissions.forEach((p) => allKeys.add(p));
    const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (key, label) VALUES (?, ?)');
    for (const key of allKeys) {
        insertPermission.run(key, key);
    }
    const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, label, is_system) VALUES (?, ?, ?)');
    const getRoleId = db.prepare('SELECT id FROM roles WHERE name = ?');
    const getPermissionId = db.prepare('SELECT id FROM permissions WHERE key = ?');
    const linkRolePermission = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const role of rbac_constants_1.DEFAULT_ROLES) {
        insertRole.run(role.name, role.label, role.isSystem ? 1 : 0);
        const roleRow = getRoleId.get(role.name);
        for (const permKey of role.permissions) {
            const permRow = getPermissionId.get(permKey);
            linkRolePermission.run(roleRow.id, permRow.id);
        }
    }
}
function seedTreatmentTypes(db) {
    const insert = db.prepare(`INSERT OR IGNORE INTO treatment_types (code, abbreviation, label, color_hex, sort_order, default_price_cents)
     VALUES (?, ?, ?, ?, ?, ?)`);
    for (const t of treatment_types_constants_1.DEFAULT_TREATMENT_TYPES) {
        insert.run(t.code, t.abbreviation, t.label, t.colorHex, t.sortOrder, t.defaultPriceCents);
    }
    const backfill = db.prepare(`UPDATE treatment_types SET default_price_cents = ? WHERE code = ? AND default_price_cents = 0`);
    for (const t of treatment_types_constants_1.DEFAULT_TREATMENT_TYPES) {
        backfill.run(t.defaultPriceCents, t.code);
    }
}
//# sourceMappingURL=reference-seed.js.map