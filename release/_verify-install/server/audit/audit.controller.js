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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const rbac_constants_1 = require("../common/rbac.constants");
const audit_service_1 = require("./audit.service");
let AuditController = class AuditController {
    constructor(auditService) {
        this.auditService = auditService;
    }
    list(limit, patientId) {
        const parsedLimit = limit ? Math.min(Number(limit) || 200, 500) : 200;
        const parsedPatientId = patientId ? Number(patientId) : undefined;
        if (parsedPatientId && !Number.isNaN(parsedPatientId)) {
            return this.auditService.forPatient(parsedPatientId, parsedLimit);
        }
        return this.auditService.recent(parsedLimit);
    }
    forPatient(patientId, limit) {
        const parsedLimit = limit ? Math.min(Number(limit) || 100, 500) : 100;
        return this.auditService.forPatient(patientId, parsedLimit);
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.AUDIT_VIEW),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('patientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "list", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.AUDIT_VIEW),
    (0, common_1.Get)('patients/:patientId'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "forPatient", null);
exports.AuditController = AuditController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('audit-log'),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map