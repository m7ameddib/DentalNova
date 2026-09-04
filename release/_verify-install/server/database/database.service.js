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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DatabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const reference_seed_1 = require("./reference-seed");
let DatabaseService = DatabaseService_1 = class DatabaseService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(DatabaseService_1.name);
    }
    onModuleInit() {
        const dbFile = this.resolveDbPath();
        fs.mkdirSync(path.dirname(dbFile), { recursive: true });
        this.db = new better_sqlite3_1.default(dbFile);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('busy_timeout = 5000');
        this.runMigrations();
        this.ensureReferenceData();
        this.logger.log(`SQLite database ready at ${dbFile}`);
    }
    onModuleDestroy() {
        this.db?.close();
    }
    get connection() {
        return this.db;
    }
    getDbPath() {
        return this.resolveDbPath();
    }
    async backupToFile(destPath) {
        await this.db.backup(destPath);
    }
    resolveDbPath() {
        const dataDir = this.config.get('DNT_DATA_DIR');
        const dbFile = this.config.get('DATABASE_FILE');
        if (dbFile && path.isAbsolute(dbFile))
            return dbFile;
        if (dataDir)
            return path.join(path.resolve(dataDir), 'data', 'clinic.db');
        if (dbFile)
            return path.join(process.cwd(), dbFile);
        return path.join(process.cwd(), 'data', 'clinic.db');
    }
    migrationsDir() {
        const explicit = this.config.get('MIGRATIONS_DIR');
        if (explicit) {
            return path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit);
        }
        const packaged = path.join(process.cwd(), 'database', 'migrations');
        if (fs.existsSync(packaged))
            return packaged;
        return path.join(process.cwd(), '..', 'database', 'migrations');
    }
    runMigrations() {
        this.db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
        const migrationsDir = this.migrationsDir();
        if (!fs.existsSync(migrationsDir)) {
            this.logger.warn(`No migrations directory found at ${migrationsDir}`);
            return;
        }
        const applied = new Set(this.db.prepare('SELECT name FROM _migrations').all().map((r) => r.name));
        const files = fs
            .readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort();
        for (const file of files) {
            if (applied.has(file))
                continue;
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
            this.logger.log(`Applying migration ${file}`);
            const apply = this.db.transaction(() => {
                this.db.exec(sql);
                this.db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            });
            try {
                apply();
            }
            catch (err) {
                this.logger.error(`Migration ${file} failed`, err);
                throw err;
            }
        }
    }
    ensureReferenceData() {
        const roleCount = this.db.prepare('SELECT COUNT(*) AS c FROM roles').get().c;
        if (roleCount === 0) {
            this.logger.log('Seeding reference data (roles, permissions, treatment catalog)...');
            (0, reference_seed_1.seedReferenceData)(this.db);
        }
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseService);
//# sourceMappingURL=database.service.js.map