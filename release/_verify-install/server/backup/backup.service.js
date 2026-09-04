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
var BackupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const database_service_1 = require("../database/database.service");
const uploads_service_1 = require("../common/uploads.service");
const version_1 = require("../common/version");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const BACKUP_VERSION = 1;
let BackupService = BackupService_1 = class BackupService {
    constructor(db, uploads, config) {
        this.db = db;
        this.uploads = uploads;
        this.config = config;
        this.logger = new common_1.Logger(BackupService_1.name);
    }
    backupsDir() {
        const dataDir = this.config.get('DNT_DATA_DIR');
        const base = dataDir ? path.resolve(dataDir) : path.dirname(this.db.getDbPath());
        const dir = path.join(base, 'backups');
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    copyDirRecursive(src, dest) {
        if (!fs.existsSync(src))
            return;
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const from = path.join(src, entry.name);
            const to = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirRecursive(from, to);
            }
            else {
                fs.copyFileSync(from, to);
            }
        }
    }
    async zipDirectory(sourceDir, zipPath) {
        if (process.platform === 'win32') {
            const src = sourceDir.replace(/'/g, "''");
            const dest = zipPath.replace(/'/g, "''");
            await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-Command',
                `Compress-Archive -Path '${src}\\*' -DestinationPath '${dest}' -Force`,
            ]);
            return;
        }
        throw new common_1.BadRequestException('Backup zip creation is supported on Windows. Use folder backup on other platforms.');
    }
    async unzipArchive(zipPath, destDir) {
        if (process.platform === 'win32') {
            fs.mkdirSync(destDir, { recursive: true });
            const src = zipPath.replace(/'/g, "''");
            const dest = destDir.replace(/'/g, "''");
            await execFileAsync('powershell.exe', [
                '-NoProfile',
                '-Command',
                `Expand-Archive -Path '${src}' -DestinationPath '${dest}' -Force`,
            ]);
            return;
        }
        throw new common_1.BadRequestException('Backup restore from zip is supported on Windows.');
    }
    validateManifest(manifest) {
        if (manifest.version !== BACKUP_VERSION) {
            throw new common_1.BadRequestException('Unsupported backup version');
        }
        if (!manifest.includes.includes('clinic.db')) {
            throw new common_1.BadRequestException('Backup is missing the database file');
        }
    }
    readManifestFromDir(dir) {
        const manifestPath = path.join(dir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new common_1.BadRequestException('Backup is missing manifest.json');
        }
        let manifest;
        try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        }
        catch {
            throw new common_1.BadRequestException('Backup manifest is invalid JSON');
        }
        this.validateManifest(manifest);
        const dbPath = path.join(dir, 'clinic.db');
        if (!fs.existsSync(dbPath)) {
            throw new common_1.BadRequestException('Backup is missing clinic.db');
        }
        return manifest;
    }
    async createBackup() {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const id = `dnt-backup-${stamp}`;
        const workDir = path.join(this.backupsDir(), `work-${stamp}`);
        fs.mkdirSync(workDir, { recursive: true });
        try {
            const dbBackupPath = path.join(workDir, 'clinic.db');
            await this.db.backupToFile(dbBackupPath);
            const uploadsSrc = this.uploads.uploadsRoot();
            const uploadsDest = path.join(workDir, 'uploads');
            this.copyDirRecursive(uploadsSrc, uploadsDest);
            const manifest = {
                version: BACKUP_VERSION,
                createdAt: new Date().toISOString(),
                appVersion: version_1.APP_VERSION,
                includes: ['clinic.db', 'uploads/'],
            };
            fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
            const zipPath = path.join(this.backupsDir(), `${id}.zip`);
            await this.zipDirectory(workDir, zipPath);
            const stat = fs.statSync(zipPath);
            return {
                id,
                filename: `${id}.zip`,
                createdAt: manifest.createdAt,
                sizeBytes: stat.size,
            };
        }
        finally {
            fs.rm(workDir, { recursive: true, force: true }, () => undefined);
        }
    }
    listBackups() {
        const dir = this.backupsDir();
        return fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.zip'))
            .map((filename) => {
            const full = path.join(dir, filename);
            const stat = fs.statSync(full);
            return {
                id: filename.replace(/\.zip$/, ''),
                filename,
                createdAt: stat.mtime.toISOString(),
                sizeBytes: stat.size,
            };
        })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getBackupStream(filename) {
        const safe = path.basename(filename);
        if (!safe.endsWith('.zip')) {
            throw new common_1.BadRequestException('Backup file not found');
        }
        const full = path.join(this.backupsDir(), safe);
        if (!fs.existsSync(full)) {
            throw new common_1.BadRequestException('Backup file not found');
        }
        return new common_1.StreamableFile((0, fs_1.createReadStream)(full), {
            type: 'application/zip',
            disposition: `attachment; filename="${safe}"`,
        });
    }
    async validateUploadedBackup(tempPath) {
        const extractDir = `${tempPath}-extract`;
        fs.mkdirSync(extractDir, { recursive: true });
        try {
            await this.unzipArchive(tempPath, extractDir);
            return this.readManifestFromDir(extractDir);
        }
        finally {
            fs.rm(extractDir, { recursive: true, force: true }, () => undefined);
        }
    }
    async restoreFromUpload(tempPath, confirm) {
        if (!confirm) {
            throw new common_1.BadRequestException('Restore requires explicit confirmation');
        }
        const manifest = await this.validateUploadedBackup(tempPath);
        const safety = await this.createBackup();
        const extractDir = path.join(this.backupsDir(), `restore-${Date.now()}`);
        fs.mkdirSync(extractDir, { recursive: true });
        try {
            await this.unzipArchive(tempPath, extractDir);
            this.readManifestFromDir(extractDir);
            const dbSrc = path.join(extractDir, 'clinic.db');
            const dbDest = this.db.getDbPath();
            const uploadsSrc = path.join(extractDir, 'uploads');
            const uploadsDest = this.uploads.uploadsRoot();
            fs.copyFileSync(dbSrc, dbDest);
            if (fs.existsSync(uploadsSrc)) {
                fs.rm(uploadsDest, { recursive: true, force: true }, () => undefined);
                this.copyDirRecursive(uploadsSrc, uploadsDest);
            }
            this.logger.warn(`Clinic data restored from backup created ${manifest.createdAt}. Restart required.`);
            return { restored: true, safetyBackupId: safety.id, restartRequired: true };
        }
        catch (err) {
            this.logger.error('Restore failed', err);
            throw new common_1.InternalServerErrorException('Restore failed — your safety backup was preserved');
        }
        finally {
            fs.rm(extractDir, { recursive: true, force: true }, () => undefined);
        }
    }
};
exports.BackupService = BackupService;
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        uploads_service_1.UploadsService,
        config_1.ConfigService])
], BackupService);
//# sourceMappingURL=backup.service.js.map