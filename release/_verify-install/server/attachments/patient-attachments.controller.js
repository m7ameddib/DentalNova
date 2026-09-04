"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAttachmentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const rbac_constants_1 = require("../common/rbac.constants");
const patient_attachments_service_1 = require("./patient-attachments.service");
const create_attachment_dto_1 = require("./dto/create-attachment.dto");
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
let PatientAttachmentsController = class PatientAttachmentsController {
    constructor(service) {
        this.service = service;
    }
    list(patientId) {
        return this.service.list(patientId);
    }
    upload(patientId, file, dto, user) {
        return this.service.upload(patientId, file, dto, user);
    }
    getFile(patientId, attachmentId, res) {
        const { absolutePath, mimeType, fileName } = this.service.getFileAbsolutePath(patientId, attachmentId);
        if (mimeType)
            res.type(mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
        res.sendFile(absolutePath);
    }
    remove(patientId, attachmentId) {
        return this.service.remove(patientId, attachmentId);
    }
};
exports.PatientAttachmentsController = PatientAttachmentsController;
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_VIEW),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], PatientAttachmentsController.prototype, "list", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_EDIT),
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { storage: (0, multer_1.memoryStorage)(), limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } })),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, create_attachment_dto_1.CreateAttachmentDto, Object]),
    __metadata("design:returntype", void 0)
], PatientAttachmentsController.prototype, "upload", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_VIEW),
    (0, common_1.Get)(':attachmentId/file'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('attachmentId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], PatientAttachmentsController.prototype, "getFile", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_EDIT),
    (0, common_1.Delete)(':attachmentId'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('attachmentId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], PatientAttachmentsController.prototype, "remove", null);
exports.PatientAttachmentsController = PatientAttachmentsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('patients/:patientId/attachments'),
    __metadata("design:paramtypes", [patient_attachments_service_1.PatientAttachmentsService])
], PatientAttachmentsController);
//# sourceMappingURL=patient-attachments.controller.js.map