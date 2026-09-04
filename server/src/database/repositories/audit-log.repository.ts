import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { AuditLogEntry } from '../../common/types';

export interface CreateAuditLogInput {
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  patientId?: number | null;
  description: string;
  userId?: number | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly db: DatabaseService) {}

  create(input: CreateAuditLogInput): AuditLogEntry {
    const result = this.db.connection
      .prepare(
        `INSERT INTO audit_log (action, entity_type, entity_id, patient_id, description, user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.patientId ?? null,
        input.description,
        input.userId ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: number): AuditLogEntry | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<AuditLogEntry>(row) : undefined;
  }

  findByPatient(patientId: number, limit = 100): AuditLogEntry[] {
    const rows = this.db.connection
      .prepare(
        `SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`,
      )
      .all(patientId, limit) as Record<string, unknown>[];
    return toCamelList<AuditLogEntry>(rows);
  }

  findRecent(limit = 200, patientId?: number): AuditLogEntry[] {
    if (patientId != null) return this.findByPatient(patientId, limit);
    const rows = this.db.connection
      .prepare(
        `SELECT a.*, u.full_name as user_name, p.full_name as patient_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN patients p ON p.id = a.patient_id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`,
      )
      .all(limit) as Record<string, unknown>[];
    return toCamelList<AuditLogEntry>(rows);
  }
}
