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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const rbac_constants_1 = require("../common/rbac.constants");
const backup_service_1 = require("./backup.service");
let BackupController = class BackupController {
    constructor(backupService) {
        this.backupService = backupService;
    }
    create() {
        return this.backupService.createBackup();
    }
    list() {
        return this.backupService.listBackups();
    }
    download(filename) {
        return this.backupService.getBackupStream(filename);
    }
    async validate(file) {
        if (!file)
            throw new Error('No backup file uploaded');
        try {
            const manifest = await this.backupService.validateUploadedBackup(file.path);
            return { valid: true, manifest };
        }
        finally {
            fs.rm(file.path, { force: true }, () => undefined);
        }
    }
    async restore(file, confirm) {
        if (!file)
            throw new Error('No backup file uploaded');
        try {
            return await this.backupService.restoreFromUpload(file.path, confirm === 'true' || confirm === '1');
        }
        finally {
            fs.rm(file.path, { force: true }, () => undefined);
        }
    }
};
exports.BackupController = BackupController;
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.SETTINGS_MANAGE),
    (0, common_1.Post)('create'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.SETTINGS_MANAGE),
    (0, common_1.Get)('list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BackupController.prototype, "list", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.SETTINGS_MANAGE),
    (0, common_1.Get)('download/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BackupController.prototype, "download", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.SETTINGS_MANAGE),
    (0, common_1.Post)('validate'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: os.tmpdir(),
            filename: (_req, file, cb) => cb(null, `dnt-restore-${Date.now()}${path.extname(file.originalname) || '.zip'}`),
        }),
        limits: { fileSize: 512 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "validate", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.SETTINGS_MANAGE),
    (0, common_1.Post)('restore'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: os.tmpdir(),
            filename: (_req, file, cb) => cb(null, `dnt-restore-${Date.now()}${path.extname(file.originalname) || '.zip'}`),
        }),
        limits: { fileSize: 512 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('confirm')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "restore", null);
exports.BackupController = BackupController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('backup'),
    __metadata("design:paramtypes", [backup_service_1.BackupService])
], BackupController);
//# sourceMappingURL=backup.controller.js.map