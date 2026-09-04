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
exports.FollowUpsRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
const local_date_util_1 = require("../../common/local-date.util");
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
function computeDisplayStatus(storedStatus, followUpDate) {
    if (storedStatus === 'COMPLETED')
        return 'COMPLETED';
    const today = todayIso();
    if (followUpDate < today)
        return 'OVERDUE';
    if (followUpDate === today)
        return 'TODAY';
    return 'UPCOMING';
}
let FollowUpsRepository = class FollowUpsRepository {
    constructor(db) {
        this.db = db;
    }
    enrichRow(row) {
        const base = (0, row_mapper_util_1.toCamel)(row);
        return {
            ...base,
            displayStatus: computeDisplayStatus(base.status, base.followUpDate),
        };
    }
    findActive(typeFilter) {
        return this.findAllActive(typeFilter);
    }
    findAllActive(typeFilter) {
        let sql = `
      SELECT f.*,
        p.full_name as patient_name,
        p.file_number as patient_file_number,
        p.phone as patient_phone,
        COALESCE((SELECT SUM(pt.final_amount_cents) FROM patient_treatments pt WHERE pt.patient_id = p.id), 0) as total_cost_cents,
        COALESCE((SELECT SUM(pay.amount_cents) FROM payments pay WHERE pay.patient_id = p.id AND COALESCE(pay.status, 'ACTIVE') != 'VOID'), 0) as total_paid_cents,
        (SELECT pay2.date FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_date,
        (SELECT pay2.amount_cents FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_amount_cents
      FROM follow_ups f
      JOIN patients p ON p.id = f.patient_id
      WHERE f.status = 'ACTIVE' AND p.archived_at IS NULL`;
        const params = [];
        if (typeFilter) {
            sql += ' AND f.type = ?';
            params.push(typeFilter);
        }
        sql += ' ORDER BY f.follow_up_date ASC, f.id ASC';
        const rows = this.db.connection.prepare(sql).all(...params);
        return rows.map((row) => {
            const enriched = this.enrichRow(row);
            if (enriched.type === 'FINANCIAL') {
                enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
            }
            return enriched;
        });
    }
    findForDate(dateIso, typeFilter) {
        let sql = `
      SELECT f.*,
        p.full_name as patient_name,
        p.file_number as patient_file_number,
        p.phone as patient_phone,
        COALESCE((SELECT SUM(pt.final_amount_cents) FROM patient_treatments pt WHERE pt.patient_id = p.id AND pt.status != 'VOID'), 0) as total_cost_cents,
        COALESCE((SELECT SUM(pay.amount_cents) FROM payments pay WHERE pay.patient_id = p.id AND COALESCE(pay.status, 'ACTIVE') != 'VOID'), 0) as total_paid_cents,
        (SELECT pay2.date FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_date,
        (SELECT pay2.amount_cents FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_amount_cents
      FROM follow_ups f
      JOIN patients p ON p.id = f.patient_id
      WHERE p.archived_at IS NULL AND (
        (f.status = 'ACTIVE' AND f.follow_up_date <= ?)
        OR (f.status = 'COMPLETED' AND date(f.completed_at) = date(?))
      )`;
        const params = [dateIso, dateIso];
        if (typeFilter) {
            sql += ' AND f.type = ?';
            params.push(typeFilter);
        }
        sql += ' ORDER BY CASE WHEN f.status = \'COMPLETED\' THEN 1 ELSE 0 END, f.follow_up_date ASC, f.id ASC';
        const rows = this.db.connection.prepare(sql).all(...params);
        return rows.map((row) => {
            const enriched = this.enrichRow(row);
            if (enriched.type === 'FINANCIAL') {
                enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
            }
            return enriched;
        });
    }
    findWorkQueue(typeFilter) {
        return this.findForDate(todayIso(), typeFilter);
    }
    findLatestHistoryForFollowUp(followUpId) {
        const row = this.db.connection
            .prepare(`SELECT h.*,
          p.full_name as patient_name,
          u.full_name as performed_by_name
         FROM follow_up_history h
         JOIN patients p ON p.id = h.patient_id
         LEFT JOIN users u ON u.id = h.performed_by_id
         WHERE h.follow_up_id = ?
         ORDER BY h.created_at DESC, h.id DESC
         LIMIT 1`)
            .get(followUpId);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByPatient(patientId) {
        const rows = this.db.connection
            .prepare(`SELECT f.*,
          p.full_name as patient_name,
          p.file_number as patient_file_number,
          p.phone as patient_phone,
          COALESCE((SELECT SUM(pt.final_amount_cents) FROM patient_treatments pt WHERE pt.patient_id = p.id), 0) as total_cost_cents,
          COALESCE((SELECT SUM(pay.amount_cents) FROM payments pay WHERE pay.patient_id = p.id AND COALESCE(pay.status, 'ACTIVE') != 'VOID'), 0) as total_paid_cents,
          (SELECT pay2.date FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_date,
          (SELECT pay2.amount_cents FROM payments pay2 WHERE pay2.patient_id = p.id AND COALESCE(pay2.status, 'ACTIVE') != 'VOID' ORDER BY pay2.date DESC, pay2.id DESC LIMIT 1) as last_payment_amount_cents
         FROM follow_ups f
         JOIN patients p ON p.id = f.patient_id
         WHERE f.patient_id = ?
         ORDER BY CASE WHEN f.status = 'ACTIVE' THEN 0 ELSE 1 END, f.follow_up_date ASC`)
            .all(patientId);
        return rows.map((row) => {
            const enriched = this.enrichRow(row);
            if (enriched.type === 'FINANCIAL') {
                enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
            }
            return enriched;
        });
    }
    findById(id) {
        const row = this.db.connection
            .prepare(`SELECT f.*,
          p.full_name as patient_name,
          p.file_number as patient_file_number,
          p.phone as patient_phone
         FROM follow_ups f
         JOIN patients p ON p.id = f.patient_id
         WHERE f.id = ?`)
            .get(id);
        return row ? this.enrichRow(row) : undefined;
    }
    findActiveFinancialByPatient(patientId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM follow_ups WHERE patient_id = ? AND type = 'FINANCIAL' AND status = 'ACTIVE'`)
            .get(patientId);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findAllActiveFinancial() {
        const rows = this.db.connection
            .prepare(`SELECT * FROM follow_ups WHERE type = 'FINANCIAL' AND status = 'ACTIVE'`)
            .all();
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO follow_ups (patient_id, type, reason, follow_up_date, details, note, patient_treatment_id, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(input.patientId, input.type, input.reason, input.followUpDate, input.details ?? null, input.note ?? null, input.patientTreatmentId ?? null, input.createdById ?? null);
        return (0, row_mapper_util_1.toCamel)(this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(Number(result.lastInsertRowid)));
    }
    updateDate(id, followUpDate, note) {
        const existing = this.findById(id);
        if (!existing || existing.status !== 'ACTIVE')
            return undefined;
        this.db.connection
            .prepare(`UPDATE follow_ups SET follow_up_date = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?`)
            .run(followUpDate, note ?? null, id);
        return (0, row_mapper_util_1.toCamel)(this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id));
    }
    updateNote(id, note) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        this.db.connection
            .prepare(`UPDATE follow_ups SET note = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(note, id);
        return (0, row_mapper_util_1.toCamel)(this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id));
    }
    complete(id) {
        const existing = this.findById(id);
        if (!existing || existing.status !== 'ACTIVE')
            return undefined;
        this.db.connection
            .prepare(`UPDATE follow_ups SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
            .run(id);
        return (0, row_mapper_util_1.toCamel)(this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id));
    }
    updateFields(id, fields) {
        const existing = this.findById(id);
        if (!existing || existing.status !== 'ACTIVE')
            return undefined;
        this.db.connection
            .prepare(`UPDATE follow_ups SET
          follow_up_date = COALESCE(?, follow_up_date),
          reason = COALESCE(?, reason),
          details = COALESCE(?, details),
          note = COALESCE(?, note),
          updated_at = datetime('now')
         WHERE id = ?`)
            .run(fields.followUpDate ?? null, fields.reason ?? null, fields.details ?? null, fields.note ?? null, id);
        return (0, row_mapper_util_1.toCamel)(this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id));
    }
    addHistory(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO follow_up_history (
          follow_up_id, patient_id, type, reason, result, note, next_follow_up_date,
          appointment_id, appointment_summary, payment_id, payment_amount_cents, performed_by_id
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(input.followUpId ?? null, input.patientId, input.type, input.reason, input.result ?? null, input.note ?? null, input.nextFollowUpDate ?? null, input.appointmentId ?? null, input.appointmentSummary ?? null, input.paymentId ?? null, input.paymentAmountCents ?? null, input.performedById ?? null);
        return (0, row_mapper_util_1.toCamel)(this.db.connection
            .prepare('SELECT * FROM follow_up_history WHERE id = ?')
            .get(Number(result.lastInsertRowid)));
    }
    findHistory(patientId, limit = 500) {
        let sql = `
      SELECT h.*,
        p.full_name as patient_name,
        u.full_name as performed_by_name
      FROM follow_up_history h
      JOIN patients p ON p.id = h.patient_id
      LEFT JOIN users u ON u.id = h.performed_by_id`;
        const params = [];
        if (patientId) {
            sql += ' WHERE h.patient_id = ?';
            params.push(patientId);
        }
        sql += ' ORDER BY h.created_at DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.connection.prepare(sql).all(...params);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    findHistoryForDate(dateIso) {
        return this.findHistoryForLocalDate(dateIso);
    }
    findHistoryForLocalDate(dateIso) {
        const { start, endExclusive } = (0, local_date_util_1.localDayUtcBounds)(dateIso);
        const rows = this.db.connection
            .prepare(`SELECT h.*,
          p.full_name as patient_name,
          u.full_name as performed_by_name
         FROM follow_up_history h
         JOIN patients p ON p.id = h.patient_id
         LEFT JOIN users u ON u.id = h.performed_by_id
         WHERE h.created_at >= ? AND h.created_at < ?
         ORDER BY h.created_at DESC`)
            .all(start, endExclusive);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    countActiveDueOnOrBefore(dateIso) {
        const row = this.db.connection
            .prepare(`SELECT COUNT(*) as total FROM follow_ups
         WHERE status = 'ACTIVE' AND follow_up_date <= ?`)
            .get(dateIso);
        return row.total ?? 0;
    }
    getSummary() {
        return this.getSummaryForDate(todayIso());
    }
    getSummaryForDate(dateIso) {
        const today = todayIso();
        const row = this.db.connection
            .prepare(`SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN type = 'CLINICAL' THEN 1 ELSE 0 END) as clinical_count,
          SUM(CASE WHEN type = 'FINANCIAL' THEN 1 ELSE 0 END) as financial_count,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count
         FROM follow_ups f
         WHERE (
           (f.status = 'ACTIVE' AND f.follow_up_date = ?)
           OR (f.status = 'COMPLETED' AND date(f.completed_at) = date(?))
         )`)
            .get(dateIso, dateIso);
        let overdue = 0;
        if (dateIso < today) {
            overdue = row.active_count ?? 0;
        }
        return {
            total: row.total_count ?? 0,
            overdue,
            clinical: row.clinical_count ?? 0,
            financial: row.financial_count ?? 0,
        };
    }
    nextFollowUpDateForPatient(patientId) {
        const row = this.db.connection
            .prepare(`SELECT follow_up_date FROM follow_ups WHERE patient_id = ? AND status = 'ACTIVE' ORDER BY follow_up_date ASC LIMIT 1`)
            .get(patientId);
        return row?.follow_up_date ?? null;
    }
};
exports.FollowUpsRepository = FollowUpsRepository;
exports.FollowUpsRepository = FollowUpsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], FollowUpsRepository);
//# sourceMappingURL=follow-ups.repository.js.map