import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { MedicalAlert } from '../../common/types';

export interface CreateMedicalAlertInput {
  patientId: number;
  alertType: string;
  label: string;
  note?: string | null;
  diseaseCatalogId?: number | null;
  createdById?: number | null;
}

export interface UpdateMedicalAlertInput {
  alertType?: string;
  label?: string;
  note?: string | null;
}

const SELECT = `
  SELECT ma.*, u.full_name as created_by_name
  FROM medical_alerts ma
  LEFT JOIN users u ON u.id = ma.created_by_id
`;

@Injectable()
export class MedicalAlertsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): MedicalAlert | undefined {
    const row = this.db.connection.prepare(`${SELECT} WHERE ma.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findByPatient(patientId: number, activeOnly = false): MedicalAlert[] {
    const sql = activeOnly
      ? `${SELECT} WHERE ma.patient_id = ? AND ma.is_active = 1 ORDER BY ma.created_at DESC, ma.id DESC`
      : `${SELECT} WHERE ma.patient_id = ? ORDER BY ma.is_active DESC, ma.created_at DESC, ma.id DESC`;
    const rows = this.db.connection.prepare(sql).all(patientId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  create(input: CreateMedicalAlertInput): MedicalAlert {
    const result = this.db.connection
      .prepare(
        `INSERT INTO medical_alerts (patient_id, alert_type, label, note, disease_catalog_id, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.patientId,
        input.alertType,
        input.label,
        input.note ?? null,
        input.diseaseCatalogId ?? null,
        input.createdById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateMedicalAlertInput): MedicalAlert | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare(
        `UPDATE medical_alerts SET alert_type = ?, label = ?, note = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(
        input.alertType ?? existing.alertType,
        input.label ?? existing.label,
        input.note !== undefined ? input.note : existing.note,
        id,
      );
    return this.findById(id);
  }

  deactivate(id: number, userId: number): MedicalAlert | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE medical_alerts SET is_active = 0, deactivated_at = datetime('now'),
         deactivated_by_id = ?, updated_at = datetime('now') WHERE id = ? AND is_active = 1`,
      )
      .run(userId, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }

  private mapRow(row: Record<string, unknown>): MedicalAlert {
    const mapped = toCamel<MedicalAlert>(row);
    mapped.isActive = Boolean(row.is_active);
    return mapped;
  }
}
