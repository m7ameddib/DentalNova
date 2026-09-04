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
exports.ClinicExpensesRepository = exports.ACTIVE_EXPENSE_SQL = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
exports.ACTIVE_EXPENSE_SQL = `COALESCE(e.status, 'ACTIVE') != 'VOID'`;
let ClinicExpensesRepository = class ClinicExpensesRepository {
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        const row = this.db.connection.prepare('SELECT * FROM clinic_expenses WHERE id = ?').get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByLabPaymentId(labPaymentId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM clinic_expenses WHERE source_lab_payment_id = ?`)
            .get(labPaymentId);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findForPeriod(fromIso, toIso) {
        const rows = this.db.connection
            .prepare(`SELECT * FROM clinic_expenses e
         WHERE date(e.date) BETWEEN date(?) AND date(?)
         ORDER BY e.date DESC, e.id DESC`)
            .all(fromIso, toIso);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    totalForPeriod(fromIso, toIso) {
        const row = this.db.connection
            .prepare(`SELECT COALESCE(SUM(e.amount_cents), 0) as total FROM clinic_expenses e
         WHERE ${exports.ACTIVE_EXPENSE_SQL} AND date(e.date) BETWEEN date(?) AND date(?)`)
            .get(fromIso, toIso);
        return row.total;
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO clinic_expenses
          (date, amount_cents, category, payment_method, note, created_by_id, source_lab_payment_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`)
            .run(input.date, input.amountCents, input.category, input.paymentMethod, input.note ?? null, input.createdById ?? null, input.sourceLabPaymentId ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    void(id, voidedById, reason) {
        const result = this.db.connection
            .prepare(`UPDATE clinic_expenses SET status = 'VOID', voided_at = datetime('now'),
         voided_by_id = ?, void_reason = ? WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`)
            .run(voidedById, reason, id);
        if (result.changes === 0)
            return undefined;
        return this.findById(id);
    }
    delete(id) {
        const result = this.db.connection.prepare('DELETE FROM clinic_expenses WHERE id = ?').run(id);
        return result.changes > 0;
    }
};
exports.ClinicExpensesRepository = ClinicExpensesRepository;
exports.ClinicExpensesRepository = ClinicExpensesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ClinicExpensesRepository);
//# sourceMappingURL=clinic-expenses.repository.js.map