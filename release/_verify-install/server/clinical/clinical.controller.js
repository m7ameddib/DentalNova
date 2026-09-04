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
exports.ClinicalController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const rbac_constants_1 = require("../common/rbac.constants");
const medical_alerts_service_1 = require("./medical-alerts.service");
const clinical_visit_notes_service_1 = require("./clinical-visit-notes.service");
const create_medical_alert_dto_1 = require("./dto/create-medical-alert.dto");
const update_medical_alert_dto_1 = require("./dto/update-medical-alert.dto");
const create_clinical_visit_note_dto_1 = require("./dto/create-clinical-visit-note.dto");
const update_clinical_visit_note_dto_1 = require("./dto/update-clinical-visit-note.dto");
let ClinicalController = class ClinicalController {
    constructor(medicalAlertsService, clinicalNotesService) {
        this.medicalAlertsService = medicalAlertsService;
        this.clinicalNotesService = clinicalNotesService;
    }
    listAlerts(patientId, activeOnly) {
        return this.medicalAlertsService.listForPatient(patientId, activeOnly === '1' || activeOnly === 'true');
    }
    createAlert(patientId, dto, user) {
        return this.medicalAlertsService.create(patientId, dto, user);
    }
    updateAlert(id, dto, user) {
        return this.medicalAlertsService.update(id, dto, user);
    }
    deactivateAlert(id, user) {
        return this.medicalAlertsService.deactivate(id, user);
    }
    listNotes(patientId) {
        return this.clinicalNotesService.listForPatient(patientId);
    }
    createNote(patientId, dto, user) {
        return this.clinicalNotesService.create(patientId, dto, user);
    }
    updateNote(id, dto, user) {
        return this.clinicalNotesService.update(id, dto, user);
    }
};
exports.ClinicalController = ClinicalController;
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_VIEW),
    (0, common_1.Get)('patients/:patientId/medical-alerts'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('activeOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "listAlerts", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.MEDICAL_ALERTS_MANAGE),
    (0, common_1.Post)('patients/:patientId/medical-alerts'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_medical_alert_dto_1.CreateMedicalAlertDto, Object]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "createAlert", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.MEDICAL_ALERTS_MANAGE),
    (0, common_1.Patch)('medical-alerts/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_medical_alert_dto_1.UpdateMedicalAlertDto, Object]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "updateAlert", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.MEDICAL_ALERTS_MANAGE),
    (0, common_1.Patch)('medical-alerts/:id/deactivate'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "deactivateAlert", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.PATIENTS_VIEW),
    (0, common_1.Get)('patients/:patientId/clinical-visit-notes'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "listNotes", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.CLINICAL_NOTES_MANAGE),
    (0, common_1.Post)('patients/:patientId/clinical-visit-notes'),
    __param(0, (0, common_1.Param)('patientId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_clinical_visit_note_dto_1.CreateClinicalVisitNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "createNote", null);
__decorate([
    (0, permissions_decorator_1.RequirePermissions)(rbac_constants_1.PERMISSIONS.CLINICAL_NOTES_MANAGE),
    (0, common_1.Patch)('clinical-visit-notes/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_clinical_visit_note_dto_1.UpdateClinicalVisitNoteDto, Object]),
    __metadata("design:returntype", void 0)
], ClinicalController.prototype, "updateNote", null);
exports.ClinicalController = ClinicalController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [medical_alerts_service_1.MedicalAlertsService,
        clinical_visit_notes_service_1.ClinicalVisitNotesService])
], ClinicalController);
//# sourceMappingURL=clinical.controller.js.map