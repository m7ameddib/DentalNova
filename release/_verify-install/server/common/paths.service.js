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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let PathsService = class PathsService {
    constructor(config) {
        this.config = config;
    }
    dataRoot() {
        const explicit = this.config.get('DNT_DATA_DIR');
        if (explicit)
            return path.resolve(explicit);
        const dbFile = this.config.get('DATABASE_FILE') || './data/clinic.db';
        const resolvedDb = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
        return path.dirname(resolvedDb);
    }
    dbFile() {
        const explicit = this.config.get('DATABASE_FILE');
        if (explicit && path.isAbsolute(explicit))
            return explicit;
        if (explicit)
            return path.join(process.cwd(), explicit);
        return path.join(this.dataRoot(), 'data', 'clinic.db');
    }
    uploadsDir() {
        return path.join(this.dataRoot(), 'attachments');
    }
    backupsDir() {
        return path.join(this.dataRoot(), 'backups');
    }
    logsDir() {
        return path.join(this.dataRoot(), 'logs');
    }
    configDir() {
        return path.join(this.dataRoot(), 'config');
    }
    licenseDir() {
        return path.join(this.dataRoot(), 'license');
    }
    jwtSecretFile() {
        return path.join(this.configDir(), 'jwt.secret');
    }
    ensureDataDirs() {
        for (const dir of [
            path.dirname(this.dbFile()),
            this.uploadsDir(),
            this.backupsDir(),
            this.logsDir(),
            this.configDir(),
            this.licenseDir(),
        ]) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
    readJwtSecret() {
        const file = this.jwtSecretFile();
        if (!fs.existsSync(file))
            return null;
        return fs.readFileSync(file, 'utf-8').trim() || null;
    }
    writeJwtSecret(secret) {
        fs.mkdirSync(this.configDir(), { recursive: true });
        fs.writeFileSync(this.jwtSecretFile(), secret, { encoding: 'utf-8', mode: 0o600 });
    }
};
exports.PathsService = PathsService;
exports.PathsService = PathsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PathsService);
//# sourceMappingURL=paths.service.js.map