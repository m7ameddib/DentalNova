"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const bcrypt = __importStar(require("bcryptjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const rbac_constants_1 = require("../common/rbac.constants");
const treatment_types_constants_1 = require("../common/treatment-types.constants");
dotenv.config();
function main() {
    const dbFile = process.env.DATABASE_FILE || './data/clinic.db';
    const resolved = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const db = new better_sqlite3_1.default(resolved);
    db.pragma('foreign_keys = ON');
    applyMigrations(db);
    seedRolesAndPermissions(db);
    seedTreatmentTypes(db);
    seedDemoUsers(db);
    db.close();
    console.log('Seed complete.');
}
function applyMigrations(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const migrationsDir = path.join(process.cwd(), '..', 'database', 'migrations');
    if (!fs.existsSync(migrationsDir))
        return;
    const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
        if (applied.has(file))
            continue;
        db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        console.log(`Applied migration ${file}`);
    }
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
        console.log(`Seeded role: ${role.name}`);
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
    console.log(`Seeded ${treatment_types_constants_1.DEFAULT_TREATMENT_TYPES.length} treatment types`);
}
function seedDemoUsers(db) {
    const getRoleId = db.prepare('SELECT id FROM roles WHERE name = ?');
    const getUser = db.prepare('SELECT id FROM users WHERE username = ?');
    const insertUser = db.prepare(`INSERT INTO users (full_name, username, password_hash, role_id) VALUES (?, ?, ?, ?)`);
    const demoUsers = [
        { fullName: 'Dr. Admin', username: 'doctor', password: 'doctor123', role: 'doctor' },
        { fullName: 'Front Desk', username: 'employee', password: 'employee123', role: 'employee' },
    ];
    for (const u of demoUsers) {
        if (getUser.get(u.username)) {
            console.log(`User already exists: ${u.username}`);
            continue;
        }
        const roleRow = getRoleId.get(u.role);
        const hash = bcrypt.hashSync(u.password, 10);
        insertUser.run(u.fullName, u.username, hash, roleRow.id);
        console.log(`Created demo user: ${u.username} / ${u.password}`);
    }
}
main();
//# sourceMappingURL=seed.js.map