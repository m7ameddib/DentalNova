import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { localDayUtcBounds } from '../../common/local-date.util';
import { FamilyGroup, Patient } from '../../common/types';

export interface CreatePatientInput {
  fullName: string;
  phone: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  approxAge?: number | null;
  weightKg?: number | null;
  address?: string | null;
  areaId?: number | null;
  medicalNotes?: string | null;
  generalNotes?: string | null;
  familyGroupId?: number | null;
  guarantorId?: number | null;
  accountDiscountCents?: number | null;
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

@Injectable()
export class PatientsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): Patient | undefined {
    const row = this.db.connection.prepare('SELECT * FROM patients WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Patient>(row) : undefined;
  }

  findByPhone(phone: string): Patient[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM patients WHERE phone = ? AND archived_at IS NULL ORDER BY created_at')
      .all(phone) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  search(query: string, limit = 50, includeArchived = false): Patient[] {
    const like = `%${query}%`;
    const archivedClause = includeArchived ? '' : ' AND archived_at IS NULL';
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM patients
         WHERE (full_name LIKE ? OR phone LIKE ? OR file_number LIKE ?)${archivedClause}
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(like, like, like, limit) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  findAll(limit = 200, includeArchived = false): Patient[] {
    const archivedClause = includeArchived ? '' : ' WHERE archived_at IS NULL';
    const rows = this.db.connection
      .prepare(`SELECT * FROM patients${archivedClause} ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  findArchived(limit = 200): Patient[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM patients WHERE archived_at IS NOT NULL ORDER BY archived_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  /** Total active (non-archived) patient count — used by Reports > Patient Summary. */
  countAll(): number {
    const row = this.db.connection
      .prepare('SELECT COUNT(*) as total FROM patients WHERE archived_at IS NULL')
      .get() as {
      total: number;
    };
    return row.total;
  }

  /** New patients registered within a date range — used by Reports > Patient Summary. */
  countCreatedForPeriod(fromIso: string, toIso: string): number {
    const row = this.db.connection
      .prepare(`SELECT COUNT(*) as total FROM patients WHERE date(created_at) BETWEEN date(?) AND date(?)`)
      .get(fromIso, toIso) as { total: number };
    return row.total;
  }

  /** Patients registered within a date range, newest first (Reports > New Patients drill-down). */
  findCreatedForPeriod(fromIso: string, toIso: string): Patient[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM patients WHERE date(created_at) BETWEEN date(?) AND date(?) ORDER BY created_at DESC`,
      )
      .all(fromIso, toIso) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  /** Patients registered on a local calendar day (Daily Report). */
  findCreatedForLocalDate(dateIso: string): Patient[] {
    const { start, endExclusive } = localDayUtcBounds(dateIso);
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM patients
         WHERE created_at >= ? AND created_at < ?
         ORDER BY created_at DESC`,
      )
      .all(start, endExclusive) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  /** Clinic-wide sum of active account discount entries. */
  totalAccountDiscountAll(): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(ad.amount_cents), 0) as total
         FROM account_discounts ad
         WHERE COALESCE(ad.status, 'ACTIVE') != 'VOID'`,
      )
      .get() as { total: number };
    return row.total;
  }

  /** Patients with a positive remaining balance (Reports > Outstanding Balance drill-down). */
  findOutstanding(): (Patient & { totalCostCents: number; totalPaidCents: number; remainingCents: number })[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM (
           SELECT p.*,
             COALESCE((SELECT SUM(pt.final_amount_cents) FROM patient_treatments pt WHERE pt.patient_id = p.id AND pt.status = 'COMPLETED'), 0)
               - COALESCE((SELECT SUM(ad.amount_cents) FROM account_discounts ad WHERE ad.patient_id = p.id AND COALESCE(ad.status, 'ACTIVE') != 'VOID'), 0) as total_cost_cents,
             COALESCE((SELECT SUM(pay.amount_cents) FROM payments pay WHERE pay.patient_id = p.id AND COALESCE(pay.status, 'ACTIVE') != 'VOID'), 0) as total_paid_cents
           FROM patients p
           WHERE p.archived_at IS NULL
         ) t
         WHERE (t.total_cost_cents - t.total_paid_cents) > 0
         ORDER BY (t.total_cost_cents - t.total_paid_cents) DESC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map((row) => {
      const mapped = toCamel<Patient & { totalCostCents: number; totalPaidCents: number }>(row);
      return { ...mapped, remainingCents: mapped.totalCostCents - mapped.totalPaidCents };
    });
  }

  findFamilyMembers(familyGroupId: number, excludePatientId?: number): Patient[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM patients WHERE family_group_id = ? AND id != ? ORDER BY created_at`,
      )
      .all(familyGroupId, excludePatientId ?? -1) as Record<string, unknown>[];
    return toCamelList<Patient>(rows);
  }

  /** Generates the next sequential file number, e.g. P-000001. */
  private generateFileNumber(): string {
    const row = this.db.connection
      .prepare(`SELECT file_number FROM patients ORDER BY id DESC LIMIT 1`)
      .get() as { file_number: string } | undefined;
    const lastSeq = row ? parseInt(row.file_number.replace(/\D/g, ''), 10) || 0 : 0;
    const next = lastSeq + 1;
    return `P-${String(next).padStart(6, '0')}`;
  }

  create(input: CreatePatientInput): Patient {
    const fileNumber = this.generateFileNumber();
    const result = this.db.connection
      .prepare(
        `INSERT INTO patients
          (file_number, full_name, phone, gender, date_of_birth, approx_age, weight_kg, address, area_id,
           medical_notes, general_notes, family_group_id, guarantor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fileNumber,
        input.fullName,
        input.phone,
        input.gender ?? null,
        input.dateOfBirth ?? null,
        input.approxAge ?? null,
        input.weightKg ?? null,
        input.address ?? null,
        input.areaId ?? null,
        input.medicalNotes ?? null,
        input.generalNotes ?? null,
        input.familyGroupId ?? null,
        input.guarantorId ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdatePatientInput): Patient | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...input };
    this.db.connection
      .prepare(
        `UPDATE patients SET
          full_name = ?, phone = ?, gender = ?, date_of_birth = ?, approx_age = ?, weight_kg = ?,
          address = ?, area_id = ?, medical_notes = ?, general_notes = ?, family_group_id = ?, guarantor_id = ?,
          account_discount_cents = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        merged.fullName,
        merged.phone,
        merged.gender ?? null,
        merged.dateOfBirth ?? null,
        merged.approxAge ?? null,
        merged.weightKg ?? null,
        merged.address ?? null,
        merged.areaId ?? null,
        merged.medicalNotes ?? null,
        merged.generalNotes ?? null,
        merged.familyGroupId ?? null,
        merged.guarantorId ?? null,
        merged.accountDiscountCents ?? 0,
        id,
      );
    return this.findById(id);
  }

  /**
   * Soft-archive a patient — data remains in the database but is hidden from
   * normal active-patient lists until restored.
   */
  archive(id: number): Patient | undefined {
    this.db.connection
      .prepare(`UPDATE patients SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .run(id);
    return this.findById(id);
  }

  restore(id: number): Patient | undefined {
    this.db.connection
      .prepare(`UPDATE patients SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?`)
      .run(id);
    return this.findById(id);
  }

  /**
   * Permanently deletes a patient. Retained for emergency use only — the normal
   * UI uses archive instead. Relies on `ON DELETE CASCADE` foreign keys.
   */
  delete(id: number): boolean {
    const result = this.db.connection.prepare('DELETE FROM patients WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ---- Family groups ----

  createFamilyGroup(contactPhone: string | null, label?: string | null): FamilyGroup {
    const result = this.db.connection
      .prepare('INSERT INTO family_groups (contact_phone, label) VALUES (?, ?)')
      .run(contactPhone, label ?? null);
    return this.findFamilyGroupById(Number(result.lastInsertRowid))!;
  }

  findFamilyGroupById(id: number): FamilyGroup | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM family_groups WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<FamilyGroup>(row) : undefined;
  }

  // ---- Medical notes (extended history) ----

  addMedicalNote(patientId: number, note: string) {
    this.db.connection
      .prepare('INSERT INTO medical_notes (patient_id, note) VALUES (?, ?)')
      .run(patientId, note);
  }

  listMedicalNotes(patientId: number) {
    const rows = this.db.connection
      .prepare('SELECT * FROM medical_notes WHERE patient_id = ? ORDER BY created_at DESC')
      .all(patientId) as Record<string, unknown>[];
    return toCamelList(rows);
  }
}
