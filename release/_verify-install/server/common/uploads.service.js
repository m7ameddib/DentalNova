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
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let UploadsService = class UploadsService {
    constructor(config) {
        this.config = config;
    }
    dataRoot() {
        const dataDir = this.config.get('DNT_DATA_DIR');
        if (dataDir)
            return path.resolve(dataDir);
        const dbFile = this.config.get('DATABASE_FILE') || './data/clinic.db';
        const resolvedDbFile = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
        return path.dirname(resolvedDbFile);
    }
    uploadsRoot() {
        const sub = this.config.get('DNT_DATA_DIR') ? 'attachments' : 'uploads';
        const dir = path.join(this.dataRoot(), sub);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    patientUploadsDir(patientId) {
        const dir = path.join(this.uploadsRoot(), 'patients', String(patientId));
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    clinicUploadsDir() {
        const dir = path.join(this.uploadsRoot(), 'clinic');
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    safeFileName(originalName) {
        const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
        const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        return `${stamp}${ext}`;
    }
    resolveManagedPath(relativePath) {
        const root = this.uploadsRoot();
        const resolved = path.resolve(root, relativePath);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            return null;
        }
        return resolved;
    }
    deleteManagedFile(relativePath) {
        const absolute = this.resolveManagedPath(relativePath);
        if (absolute && fs.existsSync(absolute)) {
            fs.unlinkSync(absolute);
        }
    }
    deletePatientDirectory(patientId) {
        const dir = path.join(this.uploadsRoot(), 'patients', String(patientId));
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map