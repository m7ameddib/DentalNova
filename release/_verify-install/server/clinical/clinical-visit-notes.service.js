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
exports.ClinicalVisitNotesService = void 0;
const common_1 = require("@nestjs/common");
const clinical_visit_notes_repository_1 = require("../database/repositories/clinical-visit-notes.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
const audit_service_1 = require("../audit/audit.service");
let ClinicalVisitNotesService = class ClinicalVisitNotesService {
    constructor(repo, patientsRepo, audit) {
        this.repo = repo;
        this.patientsRepo = patientsRepo;
        this.audit = audit;
    }
    listForPatient(patientId) {
        this.assertPatient(patientId);
        return this.repo.findByPatient(patientId);
    }
    create(patientId, dto, user) {
        this.assertPatient(patientId);
        const created = this.repo.create({
            patientId,
            visitDate: dto.visitDate,
            chiefComplaint: dto.chiefComplaint ?? null,
            examinationFindings: dto.examinationFindings ?? null,
            diagnosis: dto.diagnosis ?? null,
            procedureAction: dto.procedureAction ?? null,
            anesthesiaNote: dto.anesthesiaNote ?? null,
            clinicalNotes: dto.clinicalNotes ?? null,
            patientInstructions: dto.patientInstructions ?? null,
            createdById: user.id,
        });
        this.audit.log({
            action: 'CLINICAL_NOTE_CREATED',
            entityType: 'clinical_visit_note',
            entityId: created.id,
            patientId,
            description: `Clinical visit note for ${dto.visitDate}`,
            userId: user.id,
        });
        return created;
    }
    update(id, dto, user) {
        const existing = this.repo.findById(id);
        if (!existing)
            throw new common_1.NotFoundException('Clinical visit note not found');
        const updated = this.repo.update(id, { ...dto, updatedById: user.id });
        this.audit.log({
            action: 'CLINICAL_NOTE_UPDATED',
            entityType: 'clinical_visit_note',
            entityId: id,
            patientId: existing.patientId,
            description: `Clinical visit note updated (${updated.visitDate})`,
            userId: user.id,
        });
        return updated;
    }
    assertPatient(patientId) {
        if (!this.patientsRepo.findById(patientId))
            throw new common_1.NotFoundException('Patient not found');
    }
};
exports.ClinicalVisitNotesService = ClinicalVisitNotesService;
exports.ClinicalVisitNotesService = ClinicalVisitNotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [clinical_visit_notes_repository_1.ClinicalVisitNotesRepository,
        patients_repository_1.PatientsRepository,
        audit_service_1.AuditService])
], ClinicalVisitNotesService);
//# sourceMappingURL=clinical-visit-notes.service.js.map