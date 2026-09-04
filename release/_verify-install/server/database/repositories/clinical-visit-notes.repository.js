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
exports.ClinicalVisitNotesRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
const SELECT = `
  SELECT n.*, cu.full_name as created_by_name, uu.full_name as updated_by_name
  FROM clinical_visit_notes n
  LEFT JOIN users cu ON cu.id = n.created_by_id
  LEFT JOIN users uu ON uu.id = n.updated_by_id
`;
let ClinicalVisitNotesRepository = class ClinicalVisitNotesRepository {
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        const row = this.db.connection.prepare(`${SELECT} WHERE n.id = ?`).get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByPatient(patientId) {
        const rows = this.db.connection
            .prepare(`${SELECT} WHERE n.patient_id = ? ORDER BY n.visit_date DESC, n.created_at DESC, n.id DESC`)
            .all(patientId);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO clinical_visit_notes
          (patient_id, visit_date, chief_complaint, examination_findings, diagnosis,
           procedure_action, anesthesia_note, clinical_notes, patient_instructions, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(input.patientId, input.visitDate, input.chiefComplaint ?? null, input.examinationFindings ?? null, input.diagnosis ?? null, input.procedureAction ?? null, input.anesthesiaNote ?? null, input.clinicalNotes ?? null, input.patientInstructions ?? null, input.createdById ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        this.db.connection
            .prepare(`UPDATE clinical_visit_notes SET
          visit_date = ?, chief_complaint = ?, examination_findings = ?, diagnosis = ?,
          procedure_action = ?, anesthesia_note = ?, clinical_notes = ?, patient_instructions = ?,
          updated_by_id = ?, updated_at = datetime('now')
         WHERE id = ?`)
            .run(input.visitDate ?? existing.visitDate, input.chiefComplaint !== undefined ? input.chiefComplaint : existing.chiefComplaint, input.examinationFindings !== undefined ? input.examinationFindings : existing.examinationFindings, input.diagnosis !== undefined ? input.diagnosis : existing.diagnosis, input.procedureAction !== undefined ? input.procedureAction : existing.procedureAction, input.anesthesiaNote !== undefined ? input.anesthesiaNote : existing.anesthesiaNote, input.clinicalNotes !== undefined ? input.clinicalNotes : existing.clinicalNotes, input.patientInstructions !== undefined ? input.patientInstructions : existing.patientInstructions, input.updatedById ?? null, id);
        return this.findById(id);
    }
};
exports.ClinicalVisitNotesRepository = ClinicalVisitNotesRepository;
exports.ClinicalVisitNotesRepository = ClinicalVisitNotesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ClinicalVisitNotesRepository);
//# sourceMappingURL=clinical-visit-notes.repository.js.map