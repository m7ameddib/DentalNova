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
exports.LabCasePaymentsRepository = void 0;
exports.computeLabPaymentStatus = computeLabPaymentStatus;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database.service");
const row_mapper_util_1 = require("../row-mapper.util");
let LabCasePaymentsRepository = class LabCasePaymentsRepository {
    constructor(db) {
        this.db = db;
    }
    findById(id) {
        const row = this.db.connection
            .prepare(`SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
         FROM lab_case_payments lp
         LEFT JOIN users u ON u.id = lp.recorded_by_id
         LEFT JOIN users vu ON vu.id = lp.voided_by_id
         WHERE lp.id = ?`)
            .get(id);
        return row ? (0, row_mapper_util_1.toCamel)(row) : undefined;
    }
    findByLabCase(labCaseId) {
        const rows = this.db.connection
            .prepare(`SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
         FROM lab_case_payments lp
         LEFT JOIN users u ON u.id = lp.recorded_by_id
         LEFT JOIN users vu ON vu.id = lp.voided_by_id
         WHERE lp.lab_case_id = ?
         ORDER BY lp.payment_date DESC, lp.id DESC`)
            .all(labCaseId);
        return (0, row_mapper_util_1.toCamelList)(rows);
    }
    totalPaidForCase(labCaseId) {
        const row = this.db.connection
            .prepare(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM lab_case_payments
         WHERE lab_case_id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`)
            .get(labCaseId);
        return row.total;
    }
    create(input) {
        const result = this.db.connection
            .prepare(`INSERT INTO lab_case_payments
          (lab_case_id, amount_cents, payment_method, payment_date, note, expense_id, recorded_by_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`)
            .run(input.labCaseId, input.amountCents, input.paymentMethod, input.paymentDate, input.note ?? null, input.expenseId, input.recordedById ?? null);
        return this.findById(Number(result.lastInsertRowid));
    }
    void(id, voidedById, reason) {
        const result = this.db.connection
            .prepare(`UPDATE lab_case_payments SET status = 'VOID', voided_at = datetime('now'),
         voided_by_id = ?, void_reason = ? WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`)
            .run(voidedById, reason, id);
        if (result.changes === 0)
            return undefined;
        return this.findById(id);
    }
};
exports.LabCasePaymentsRepository = LabCasePaymentsRepository;
exports.LabCasePaymentsRepository = LabCasePaymentsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], LabCasePaymentsRepository);
function computeLabPaymentStatus(labCostCents, totalPaidCents) {
    if (labCostCents <= 0) {
        return totalPaidCents > 0 ? 'PAID' : 'UNPAID';
    }
    if (totalPaidCents <= 0)
        return 'UNPAID';
    if (totalPaidCents >= labCostCents)
        return 'PAID';
    return 'PARTIALLY_PAID';
}
//# sourceMappingURL=lab-case-payments.repository.js.map