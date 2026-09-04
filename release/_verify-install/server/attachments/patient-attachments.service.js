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
exports.PatientAttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const patient_attachments_repository_1 = require("../database/repositories/patient-attachments.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
const patient_treatments_repository_1 = require("../database/repositories/patient-treatments.repository");
const clinical_visit_notes_repository_1 = require("../database/repositories/clinical-visit-notes.repository");
const uploads_service_1 = require("../common/uploads.service");
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
let PatientAttachmentsService = class PatientAttachmentsService {
    constructor(repo, patientsRepo, treatmentsRepo, visitNotesRepo, uploads) {
        this.repo = repo;
        this.patientsRepo = patientsRepo;
        this.treatmentsRepo = treatmentsRepo;
        this.visitNotesRepo = visitNotesRepo;
        this.uploads = uploads;
    }
    list(patientId) {
        this.assertPatientExists(patientId);
        return this.repo.findByPatient(patientId);
    }
    upload(patientId, file, dto, currentUser) {
        this.assertPatientExists(patientId);
        if (!file)
            throw new common_1.BadRequestException('No file uploaded');
        if (file.size > MAX_FILE_SIZE_BYTES)
            throw new common_1.BadRequestException('File is too large (max 25MB)');
        if (dto.patientTreatmentId) {
            const treatment = this.treatmentsRepo.findById(dto.patientTreatmentId);
            if (!treatment || treatment.patientId !== patientId) {
                throw new common_1.BadRequestException('Invalid treatment link');
            }
        }
        if (dto.clinicalVisitNoteId) {
            const note = this.visitNotesRepo.findById(dto.clinicalVisitNoteId);
            if (!note || note.patientId !== patientId) {
                throw new common_1.BadRequestException('Invalid clinical visit link');
            }
        }
        const teeth = this.parseTeeth(dto.teeth);
        const dir = this.uploads.patientUploadsDir(patientId);
        const fileName = this.uploads.safeFileName(file.originalname);
        fs.writeFileSync(path.join(dir, fileName), file.buffer);
        const relativePath = path.join('patients', String(patientId), fileName);
        return this.repo.create({
            patientId,
            originalFileName: file.originalname,
            category: dto.category,
            storedPath: relativePath,
            mimeType: file.mimetype,
            fileSize: file.size,
            note: dto.note ?? null,
            uploadedById: currentUser.id,
            patientTreatmentId: dto.patientTreatmentId ?? null,
            clinicalVisitNoteId: dto.clinicalVisitNoteId ?? null,
            teeth,
        });
    }
    getFileAbsolutePath(patientId, attachmentId) {
        const attachment = this.repo.findById(attachmentId);
        if (!attachment || attachment.patientId !== patientId) {
            throw new common_1.NotFoundException('Attachment not found');
        }
        const absolutePath = this.uploads.resolveManagedPath(attachment.storedPath);
        if (!absolutePath || !fs.existsSync(absolutePath)) {
            throw new common_1.NotFoundException('File not found');
        }
        return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.originalFileName };
    }
    remove(patientId, attachmentId) {
        const attachment = this.repo.findById(attachmentId);
        if (!attachment || attachment.patientId !== patientId) {
            throw new common_1.NotFoundException('Attachment not found');
        }
        this.repo.delete(attachmentId);
        this.uploads.deleteManagedFile(attachment.storedPath);
        return { id: attachmentId, patientId };
    }
    parseTeeth(raw) {
        if (!raw?.trim())
            return [];
        const teeth = raw
            .split(/[,\s]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n >= 11 && n <= 48);
        return [...new Set(teeth)].sort((a, b) => a - b);
    }
    assertPatientExists(patientId) {
        if (!this.patientsRepo.findById(patientId))
            throw new common_1.NotFoundException('Patient not found');
    }
};
exports.PatientAttachmentsService = PatientAttachmentsService;
exports.PatientAttachmentsService = PatientAttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [patient_attachments_repository_1.PatientAttachmentsRepository,
        patients_repository_1.PatientsRepository,
        patient_treatments_repository_1.PatientTreatmentsRepository,
        clinical_visit_notes_repository_1.ClinicalVisitNotesRepository,
        uploads_service_1.UploadsService])
], PatientAttachmentsService);
//# sourceMappingURL=patient-attachments.service.js.map