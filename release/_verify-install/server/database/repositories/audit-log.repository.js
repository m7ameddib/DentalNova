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
exports.AuditLogRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let AuditLogRepository = class AuditLogRepository {
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO audit_log (action, entity_type, entity_id, patient_id, description, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .run(input.action, input.entityType ?? null, input.entityId ?? null, input.patientId ?? null, input.description, input.userId ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    findById(id) {
        const row = this.db.connection
            .prepare(`SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ?`)
            .get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByPatient(patientId, limit = 100) {
        const rows = this.db.connection
            .prepare(`SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`)
            .all(patientId, limit);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findRecent(limit = 200, patientId) {
        if (patientId != null)
            return this.findByPatient(patientId, limit);
        const rows = this.db.connection
            .prepare(`SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`)
            .all(limit);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
};
exports.AuditLogRepository = AuditLogRepository;
exports.AuditLogRepository = AuditLogRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AuditLogRepository);
//# sourceMappingURL=audit-log.repository.js.map