"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalModule = void 0;
const common_1 = require("@nestjs/common");
const clinical_controller_1 = require("./clinical.controller");
const medical_alerts_service_1 = require("./medical-alerts.service");
const clinical_visit_notes_service_1 = require("./clinical-visit-notes.service");
const medical_alerts_repository_1 = require("../database/repositories/medical-alerts.repository");
const clinical_visit_notes_repository_1 = require("../database/repositories/clinical-visit-notes.repository");
const patients_repository_1 = require("../database/repositories/patients.repository");
let ClinicalModule = class ClinicalModule {
};
exports.ClinicalModule = ClinicalModule;
exports.ClinicalModule = ClinicalModule = __decorate([
    (0, common_1.Module)({
        controllers: [clinical_controller_1.ClinicalController],
        providers: [
            medical_alerts_service_1.MedicalAlertsService,
            clinical_visit_notes_service_1.ClinicalVisitNotesService,
            medical_alerts_repository_1.MedicalAlertsRepository,
            clinical_visit_notes_repository_1.ClinicalVisitNotesRepository,
            patients_repository_1.PatientsRepository,
        ],
        exports: [medical_alerts_service_1.MedicalAlertsService, clinical_visit_notes_service_1.ClinicalVisitNotesService],
    })
], ClinicalModule);
//# sourceMappingURL=clinical.module.js.map