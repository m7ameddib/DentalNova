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
exports.AppointmentsRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let AppointmentsRepository = class AppointmentsRepository {
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        const row = this.db.connection
            .prepare('SELECT * FROM appointments WHERE id = ?')
            .get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByPatient(patientId, upcomingOnly = false, limit = 20) {
        const query = upcomingOnly
            ? `SELECT * FROM appointments
         WHERE patient_id = ?
           AND status NOT IN ('COMPLETED', 'CANCELLED')
           AND (
             status IN ('WAITING', 'IN_TREATMENT')
             OR date(date) > date('now')
             OR (date(date) = date('now') AND time >= strftime('%H:%M', 'now'))
           )
         ORDER BY date ASC, time ASC LIMIT ?`
            : `SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, time DESC LIMIT ?`;
        const rows = this.db.connection.prepare(query).all(patientId, limit);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    countByMonth(yearMonth) {
        const rows = this.db.connection
            .prepare(`SELECT date, COUNT(*) as count
         FROM appointments
         WHERE date LIKE ? AND status != 'CANCELLED'
         GROUP BY date`)
            .all(`${yearMonth}%`);
        return rows;
    }
    findByDate(date) {
        const rows = this.db.connection
            .prepare(`SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.date = ?
         ORDER BY a.time ASC`)
            .all(date);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findActiveByDate(date) {
        const rows = this.db.connection
            .prepare(`SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.date = ? AND a.status != 'CANCELLED'
         ORDER BY a.time ASC`)
            .all(date);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findDetailedById(id) {
        const row = this.db.connection
            .prepare(`SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ?`)
            .get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO appointments
          (patient_id, guest_name, guest_phone, date, time, duration_min, appointment_type, reason, notes, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(input.patientId ?? null, input.guestName ?? null, input.guestPhone ?? null, input.date, input.time, input.durationMin ?? 30, input.appointmentType ?? 'CHECKUP', input.reason ?? null, input.notes ?? null, input.createdById ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    updateStatus(id, status) {
        this.db.connection
            .prepare(`UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(status, id);
        return this.findById(id);
    }
    linkPatient(id, patientId) {
        this.db.connection
            .prepare(`UPDATE appointments SET patient_id = ?, guest_name = NULL, guest_phone = NULL, updated_at = datetime('now') WHERE id = ?`)
            .run(patientId, id);
        return this.findById(id);
    }
    update(id, input) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const patientId = input.patientId !== undefined ? input.patientId : existing.patientId;
        const date = input.date ?? existing.date;
        const time = input.time ?? existing.time;
        const durationMin = input.durationMin ?? existing.durationMin;
        const reason = input.reason !== undefined ? input.reason : existing.reason;
        const guestName = patientId != null ? null : input.guestName !== undefined ? input.guestName : existing.guestName;
        const guestPhone = patientId != null ? null : input.guestPhone !== undefined ? input.guestPhone : existing.guestPhone;
        this.db.connection
            .prepare(`UPDATE appointments
         SET patient_id = ?, date = ?, time = ?, duration_min = ?, reason = ?, guest_name = ?, guest_phone = ?,
             updated_at = datetime('now')
         WHERE id = ?`)
            .run(patientId, date, time, durationMin, reason, guestName, guestPhone, id);
        return this.findById(id);
    }
    recordReminderSent(id) {
        this.db.connection
            .prepare(`UPDATE appointments SET reminder_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
            .run(id);
        return this.findById(id);
    }
    findForPeriodDetailed(fromIso, toIso, status) {
        const rows = this.db.connection
            .prepare(`SELECT a.*,
                COALESCE(p.full_name, a.guest_name) as patient_name,
                p.file_number as patient_file_number,
                p.phone as patient_phone
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE date(a.date) BETWEEN date(?) AND date(?)
           ${status ? 'AND a.status = ?' : ''}
         ORDER BY a.date ASC, a.time ASC`)
            .all(...(status ? [fromIso, toIso, status] : [fromIso, toIso]));
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    countByStatusForPeriod(fromIso, toIso) {
        const rows = this.db.connection
            .prepare(`SELECT status, COUNT(*) as count FROM appointments
         WHERE date(date) BETWEEN date(?) AND date(?)
         GROUP BY status`)
            .all(fromIso, toIso);
        return rows;
    }
};
exports.AppointmentsRepository = AppointmentsRepository;
exports.AppointmentsRepository = AppointmentsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AppointmentsRepository);
//# sourceMappingURL=appointments.repository.js.map