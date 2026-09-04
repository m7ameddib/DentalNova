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
exports.MedicalAlertsRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
const SELECT = `
  SELECT ma.*, u.full_name as created_by_name
  FROM medical_alerts ma
  LEFT JOIN users u ON u.id = ma.created_by_id
`;
let MedicalAlertsRepository = class MedicalAlertsRepository {
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        const row = this.db.connection.prepare(`${SELECT} WHERE ma.id = ?`).get(id);
        return row ? this.mapRow(row) : undefined;
    }
    findByPatient(patientId, activeOnly = false) {
        const sql = activeOnly
            ? `${SELECT} WHERE ma.patient_id = ? AND ma.is_active = 1 ORDER BY ma.created_at DESC, ma.id DESC`
            : `${SELECT} WHERE ma.patient_id = ? ORDER BY ma.is_active DESC, ma.created_at DESC, ma.id DESC`;
        const rows = this.db.connection.prepare(sql).all(patientId);
        return rows.map((r) => this.mapRow(r));
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO medical_alerts (patient_id, alert_type, label, note, created_by_id)
         VALUES (?, ?, ?, ?, ?)`)
            .run(input.patientId, input.alertType, input.label, input.note ?? null, input.createdById ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        this.db.connection
            .prepare(`UPDATE medical_alerts SET alert_type = ?, label = ?, note = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(input.alertType ?? existing.alertType, input.label ?? existing.label, input.note !== undefined ? input.note : existing.note, id);
        return this.findById(id);
    }
    deactivate(id, userId) {
        const result = this.db.connection
            .prepare(`UPDATE medical_alerts SET is_active = 0, deactivated_at = datetime('now'),
         deactivated_by_id = ?, updated_at = datetime('now') WHERE id = ? AND is_active = 1`)
            .run(userId, id);
        if (result.changes === 0)
            return undefined;
        return this.findById(id);
    }
    mapRow(row) {
        const mapped = (0, row_mapper_util_1.toCamel)(row);
        mapped.isActive = Boolean(row.is_active);
        return mapped;
    }
};
exports.MedicalAlertsRepository = MedicalAlertsRepository;
exports.MedicalAlertsRepository = MedicalAlertsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], MedicalAlertsRepository);
//# sourceMappingURL=medical-alerts.repository.js.map