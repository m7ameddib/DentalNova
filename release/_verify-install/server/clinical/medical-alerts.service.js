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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalAlertsService = exports.MEDICAL_ALERT_PRESETS = void 0;
const common_1 = require("@nestjs/common");
const medical_alerts_repository_1 = require("../database/repositories/medical-alerts.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
const audit_service_1 = require("../audit/audit.service");
exports.MEDICAL_ALERT_PRESETS = {
    ALLERGY: 'Allergy',
    PENICILLIN_ALLERGY: 'Penicillin Allergy',
    ANTICOAGULANTS: 'Anticoagulants / Blood Thinners',
    DIABETES: 'Diabetes',
    HYPERTENSION: 'Hypertension',
    PREGNANCY: 'Pregnancy',
    HEART_CONDITION: 'Heart Condition',
    OTHER: 'Other',
};
let MedicalAlertsService = class MedicalAlertsService {
    constructor(repo, patientsRepo, audit) {
        this.repo = repo;
        this.patientsRepo = patientsRepo;
        this.audit = audit;
    }
    listForPatient(patientId, activeOnly = false) {
        this.assertPatient(patientId);
        return this.repo.findByPatient(patientId, activeOnly);
    }
    create(patientId, dto, user) {
        this.assertPatient(patientId);
        const label = this.resolveLabel(dto.alertType, dto.label);
        const created = this.repo.create({
            patientId,
            alertType: dto.alertType,
            label,
            note: dto.note ?? null,
            createdById: user.id,
        });
        this.audit.log({
            action: 'MEDICAL_ALERT_CREATED',
            entityType: 'medical_alert',
            entityId: created.id,
            patientId,
            description: `Medical alert added: ${label}`,
            userId: user.id,
        });
        return created;
    }
    update(id, dto, user) {
        const existing = this.repo.findById(id);
        if (!existing)
            throw new common_1.NotFoundException('Medical alert not found');
        const label = dto.alertType || dto.label ? this.resolveLabel(dto.alertType ?? existing.alertType, dto.label ?? existing.label) : undefined;
        const updated = this.repo.update(id, {
            alertType: dto.alertType,
            label,
            note: dto.note,
        });
        this.audit.log({
            action: 'MEDICAL_ALERT_UPDATED',
            entityType: 'medical_alert',
            entityId: id,
            patientId: existing.patientId,
            description: `Medical alert updated: ${updated.label}`,
            userId: user.id,
        });
        return updated;
    }
    deactivate(id, user) {
        const existing = this.repo.findById(id);
        if (!existing)
            throw new common_1.NotFoundException('Medical alert not found');
        const updated = this.repo.deactivate(id, user.id);
        if (!updated)
            throw new common_1.BadRequestException('Alert is already inactive');
        this.audit.log({
            action: 'MEDICAL_ALERT_DEACTIVATED',
            entityType: 'medical_alert',
            entityId: id,
            patientId: existing.patientId,
            description: `Medical alert deactivated: ${existing.label}`,
            userId: user.id,
        });
        return updated;
    }
    resolveLabel(alertType, customLabel) {
        if (alertType === 'OTHER') {
            const trimmed = customLabel?.trim();
            if (!trimmed)
                throw new common_1.BadRequestException('Label is required for custom alerts');
            return trimmed;
        }
        return exports.MEDICAL_ALERT_PRESETS[alertType] ?? customLabel?.trim() ?? alertType;
    }
    assertPatient(patientId) {
        if (!this.patientsRepo.findById(patientId))
            throw new common_1.NotFoundException('Patient not found');
    }
};
exports.MedicalAlertsService = MedicalAlertsService;
exports.MedicalAlertsService = MedicalAlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [medical_alerts_repository_1.MedicalAlertsRepository,
        patients_repository_1.PatientsRepository,
        audit_service_1.AuditService])
], MedicalAlertsService);
//# sourceMappingURL=medical-alerts.service.js.map