import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { localDayUtcBounds } from '../../common/local-date.util';
import {
  FollowUp,
  FollowUpHistoryEntry,
  FollowUpResult,
  FollowUpStoredStatus,
  FollowUpType,
  FollowUpWithPatient,
} from '../../common/types';

export interface CreateFollowUpInput {
  patientId: number;
  type: FollowUpType;
  reason: string;
  followUpDate: string;
  details?: string | null;
  note?: string | null;
  patientTreatmentId?: number | null;
  createdById?: number | null;
}

export interface CreateFollowUpHistoryInput {
  followUpId?: number | null;
  patientId: number;
  type: FollowUpType;
  reason: string;
  result?: FollowUpResult | null;
  note?: string | null;
  nextFollowUpDate?: string | null;
  appointmentId?: number | null;
  appointmentSummary?: string | null;
  paymentId?: number | null;
  paymentAmountCents?: number | null;
  performedById?: number | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeDisplayStatus(storedStatus: FollowUpStoredStatus, followUpDate: string): FollowUpWithPatient['displayStatus'] {
  if (storedStatus === 'COMPLETED') return 'COMPLETED';
  const today = todayIso();
  if (followUpDate < today) return 'OVERDUE';
  if (followUpDate === today) return 'TODAY';
  return 'UPCOMING';
}

@Injectable()
export class FollowUpsRepository {
  constructor(private readonly db: DatabaseService) {}

  private enrichRow(row: Record<string, unknown>): FollowUpWithPatient {
    const base = toCamel<FollowUp & {
      patientName: string;
      patientFileNumber: string;
      patientPhone: string;
      remainingCents?: number;
      totalCostCents?: number;
      totalPaidCents?: number;
      lastPaymentDate?: string | null;
      lastPaymentAmountCents?: number | null;
    }>(row);
    return {
      ...base,
      displayStatus: computeDisplayStatus(base.status, base.followUpDate),
    };
  }

  findActive(typeFilter?: FollowUpType): FollowUpWithPatient[] {
    return this.findAllActive(typeFilter);
  }

  /** All active follow-ups (used by daily report pending calculation). */
  findAllActive(typeFilter?: FollowUpType): FollowUpWithPatient[] {
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
    const params: unknown[] = [];
    if (typeFilter) {
      sql += ' AND f.type = ?';
      params.push(typeFilter);
    }
    sql += ' ORDER BY f.follow_up_date ASC, f.id ASC';
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => {
      const enriched = this.enrichRow(row);
      if (enriched.type === 'FINANCIAL') {
        enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
      }
      return enriched;
    });
  }

  /** Active follow-ups due on or before a date, plus items completed on that date. */
  findForDate(dateIso: string, typeFilter?: FollowUpType): FollowUpWithPatient[] {
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
    const params: unknown[] = [dateIso, dateIso];
    if (typeFilter) {
      sql += ' AND f.type = ?';
      params.push(typeFilter);
    }
    sql += ' ORDER BY CASE WHEN f.status = \'COMPLETED\' THEN 1 ELSE 0 END, f.follow_up_date ASC, f.id ASC';
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => {
      const enriched = this.enrichRow(row);
      if (enriched.type === 'FINANCIAL') {
        enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
      }
      return enriched;
    });
  }

  /** @deprecated Use findForDate — kept as alias for callers expecting today's queue. */
  findWorkQueue(typeFilter?: FollowUpType): FollowUpWithPatient[] {
    return this.findForDate(todayIso(), typeFilter);
  }

  findLatestHistoryForFollowUp(followUpId: number): FollowUpHistoryEntry | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT h.*,
          p.full_name as patient_name,
          u.full_name as performed_by_name
         FROM follow_up_history h
         JOIN patients p ON p.id = h.patient_id
         LEFT JOIN users u ON u.id = h.performed_by_id
         WHERE h.follow_up_id = ?
         ORDER BY h.created_at DESC, h.id DESC
         LIMIT 1`,
      )
      .get(followUpId) as Record<string, unknown> | undefined;
    return row ? toCamel<FollowUpHistoryEntry>(row) : undefined;
  }

  findByPatient(patientId: number): FollowUpWithPatient[] {
    const rows = this.db.connection
      .prepare(
        `SELECT f.*,
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
         ORDER BY CASE WHEN f.status = 'ACTIVE' THEN 0 ELSE 1 END, f.follow_up_date ASC`,
      )
      .all(patientId) as Record<string, unknown>[];
    return rows.map((row) => {
      const enriched = this.enrichRow(row);
      if (enriched.type === 'FINANCIAL') {
        enriched.remainingCents = Math.max(0, (enriched.totalCostCents ?? 0) - (enriched.totalPaidCents ?? 0));
      }
      return enriched;
    });
  }

  findById(id: number): FollowUpWithPatient | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT f.*,
          p.full_name as patient_name,
          p.file_number as patient_file_number,
          p.phone as patient_phone
         FROM follow_ups f
         JOIN patients p ON p.id = f.patient_id
         WHERE f.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.enrichRow(row) : undefined;
  }

  findActiveFinancialByPatient(patientId: number): FollowUp | undefined {
    const row = this.db.connection
      .prepare(`SELECT * FROM follow_ups WHERE patient_id = ? AND type = 'FINANCIAL' AND status = 'ACTIVE'`)
      .get(patientId) as Record<string, unknown> | undefined;
    return row ? toCamel<FollowUp>(row) : undefined;
  }

  findAllActiveFinancial(): FollowUp[] {
    const rows = this.db.connection
      .prepare(`SELECT * FROM follow_ups WHERE type = 'FINANCIAL' AND status = 'ACTIVE'`)
      .all() as Record<string, unknown>[];
    return toCamelList<FollowUp>(rows);
  }

  create(input: CreateFollowUpInput): FollowUp {
    const result = this.db.connection
      .prepare(
        `INSERT INTO follow_ups (patient_id, type, reason, follow_up_date, details, note, patient_treatment_id, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.patientId,
        input.type,
        input.reason,
        input.followUpDate,
        input.details ?? null,
        input.note ?? null,
        input.patientTreatmentId ?? null,
        input.createdById ?? null,
      );
    return toCamel<FollowUp>(
      this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<
        string,
        unknown
      >,
    );
  }

  updateDate(id: number, followUpDate: string, note?: string | null): FollowUp | undefined {
    const existing = this.findById(id);
    if (!existing || existing.status !== 'ACTIVE') return undefined;
    this.db.connection
      .prepare(`UPDATE follow_ups SET follow_up_date = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?`)
      .run(followUpDate, note ?? null, id);
    return toCamel<FollowUp>(
      this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as Record<string, unknown>,
    );
  }

  updateNote(id: number, note: string): FollowUp | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare(`UPDATE follow_ups SET note = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(note, id);
    return toCamel<FollowUp>(
      this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as Record<string, unknown>,
    );
  }

  complete(id: number): FollowUp | undefined {
    const existing = this.findById(id);
    if (!existing || existing.status !== 'ACTIVE') return undefined;
    this.db.connection
      .prepare(`UPDATE follow_ups SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .run(id);
    return toCamel<FollowUp>(
      this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as Record<string, unknown>,
    );
  }

  updateFields(
    id: number,
    fields: { followUpDate?: string; reason?: string; details?: string | null; note?: string | null },
  ): FollowUp | undefined {
    const existing = this.findById(id);
    if (!existing || existing.status !== 'ACTIVE') return undefined;
    this.db.connection
      .prepare(
        `UPDATE follow_ups SET
          follow_up_date = COALESCE(?, follow_up_date),
          reason = COALESCE(?, reason),
          details = COALESCE(?, details),
          note = COALESCE(?, note),
          updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        fields.followUpDate ?? null,
        fields.reason ?? null,
        fields.details ?? null,
        fields.note ?? null,
        id,
      );
    return toCamel<FollowUp>(
      this.db.connection.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as Record<string, unknown>,
    );
  }

  addHistory(input: CreateFollowUpHistoryInput): FollowUpHistoryEntry {
    const result = this.db.connection
      .prepare(
        `INSERT INTO follow_up_history (
          follow_up_id, patient_id, type, reason, result, note, next_follow_up_date,
          appointment_id, appointment_summary, payment_id, payment_amount_cents, performed_by_id
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.followUpId ?? null,
        input.patientId,
        input.type,
        input.reason,
        input.result ?? null,
        input.note ?? null,
        input.nextFollowUpDate ?? null,
        input.appointmentId ?? null,
        input.appointmentSummary ?? null,
        input.paymentId ?? null,
        input.paymentAmountCents ?? null,
        input.performedById ?? null,
      );
    return toCamel<FollowUpHistoryEntry>(
      this.db.connection
        .prepare('SELECT * FROM follow_up_history WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as Record<string, unknown>,
    );
  }

  findHistory(patientId?: number, limit = 500): FollowUpHistoryEntry[] {
    let sql = `
      SELECT h.*,
        p.full_name as patient_name,
        u.full_name as performed_by_name
      FROM follow_up_history h
      JOIN patients p ON p.id = h.patient_id
      LEFT JOIN users u ON u.id = h.performed_by_id`;
    const params: unknown[] = [];
    if (patientId) {
      sql += ' WHERE h.patient_id = ?';
      params.push(patientId);
    }
    sql += ' ORDER BY h.created_at DESC LIMIT ?';
    params.push(limit);
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return toCamelList<FollowUpHistoryEntry>(rows);
  }

  findHistoryForDate(dateIso: string): FollowUpHistoryEntry[] {
    return this.findHistoryForLocalDate(dateIso);
  }

  /** Follow-up history entries on a local calendar day (Daily Report). */
  findHistoryForLocalDate(dateIso: string): FollowUpHistoryEntry[] {
    const { start, endExclusive } = localDayUtcBounds(dateIso);
    const rows = this.db.connection
      .prepare(
        `SELECT h.*,
          p.full_name as patient_name,
          u.full_name as performed_by_name
         FROM follow_up_history h
         JOIN patients p ON p.id = h.patient_id
         LEFT JOIN users u ON u.id = h.performed_by_id
         WHERE h.created_at >= ? AND h.created_at < ?
         ORDER BY h.created_at DESC`,
      )
      .all(start, endExclusive) as Record<string, unknown>[];
    return toCamelList<FollowUpHistoryEntry>(rows);
  }

  countActiveDueOnOrBefore(dateIso: string): number {
    const row = this.db.connection
      .prepare(
        `SELECT COUNT(*) as total FROM follow_ups
         WHERE status = 'ACTIVE' AND follow_up_date <= ?`,
      )
      .get(dateIso) as { total: number };
    return row.total ?? 0;
  }

  getSummary(): { total: number; overdue: number; clinical: number; financial: number } {
    return this.getSummaryForDate(todayIso());
  }

  getSummaryForDate(dateIso: string): { total: number; overdue: number; clinical: number; financial: number } {
    const today = todayIso();
    const row = this.db.connection
      .prepare(
        `SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN type = 'CLINICAL' THEN 1 ELSE 0 END) as clinical_count,
          SUM(CASE WHEN type = 'FINANCIAL' THEN 1 ELSE 0 END) as financial_count,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count
         FROM follow_ups f
         WHERE (
           (f.status = 'ACTIVE' AND f.follow_up_date = ?)
           OR (f.status = 'COMPLETED' AND date(f.completed_at) = date(?))
         )`,
      )
      .get(dateIso, dateIso) as {
      total_count: number;
      clinical_count: number;
      financial_count: number;
      active_count: number;
    };

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

  /** Next active follow-up date for a patient (earliest). */
  nextFollowUpDateForPatient(patientId: number): string | null {
    const row = this.db.connection
      .prepare(
        `SELECT follow_up_date FROM follow_ups WHERE patient_id = ? AND status = 'ACTIVE' ORDER BY follow_up_date ASC LIMIT 1`,
      )
      .get(patientId) as { follow_up_date: string } | undefined;
    return row?.follow_up_date ?? null;
  }

  /** Deletes follow-ups created from a patient treatment (hard delete). */
  deleteByTreatmentId(treatmentId: number): void {
    const ids = this.db.connection
      .prepare(`SELECT id FROM follow_ups WHERE patient_treatment_id = ?`)
      .all(treatmentId) as { id: number }[];
    const deleteHistory = this.db.connection.prepare(`DELETE FROM follow_up_history WHERE follow_up_id = ?`);
    const deleteFollowUp = this.db.connection.prepare(`DELETE FROM follow_ups WHERE id = ?`);
    for (const { id } of ids) {
      deleteHistory.run(id);
      deleteFollowUp.run(id);
    }
  }
}
