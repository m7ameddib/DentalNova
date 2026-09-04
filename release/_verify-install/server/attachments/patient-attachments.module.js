"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAttachmentsModule = void 0;
const common_1 = require("@nestjs/common");
const patient_attachments_controller_1 = require("./patient-attachments.controller");
const patient_attachments_service_1 = require("./patient-attachments.service");
const patient_attachments_repository_1 = require("../database/repositories/patient-attachments.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
const patient_treatments_repository_1 = require("../database/repositories/patient-treatments.repository");
const clinical_visit_notes_repository_1 = require("../database/repositories/clinical-visit-notes.repository");
const uploads_service_1 = require("../common/uploads.service");
let PatientAttachmentsModule = class PatientAttachmentsModule {
};
exports.PatientAttachmentsModule = PatientAttachmentsModule;
exports.PatientAttachmentsModule = PatientAttachmentsModule = __decorate([
    (0, common_1.Module)({
        controllers: [patient_attachments_controller_1.PatientAttachmentsController],
        providers: [
            patient_attachments_service_1.PatientAttachmentsService,
            patient_attachments_repository_1.PatientAttachmentsRepository,
            patients_repository_1.PatientsRepository,
            patient_treatments_repository_1.PatientTreatmentsRepository,
            clinical_visit_notes_repository_1.ClinicalVisitNotesRepository,
            uploads_service_1.UploadsService,
        ],
    })
], PatientAttachmentsModule);
//# sourceMappingURL=patient-attachments.module.js.map