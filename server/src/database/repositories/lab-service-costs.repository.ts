import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';

export interface LabServiceCost {
  id: number;
  labNameId: number;
  workTypeCode: string;
  costCents: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class LabServiceCostsRepository {
  constructor(private readonly db: DatabaseService) {}

  findByLab(labNameId: number): LabServiceCost[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM lab_service_costs WHERE lab_name_id = ? ORDER BY work_type_code')
      .all(labNameId) as Record<string, unknown>[];
    return toCamelList<LabServiceCost>(rows);
  }

  findCost(labNameId: number, workTypeCode: string): number | undefined {
    const row = this.db.connection
      .prepare('SELECT cost_cents FROM lab_service_costs WHERE lab_name_id = ? AND work_type_code = ?')
      .get(labNameId, workTypeCode) as { cost_cents: number } | undefined;
    return row?.cost_cents;
  }

  upsert(labNameId: number, workTypeCode: string, costCents: number): LabServiceCost {
    this.db.connection
      .prepare(
        `INSERT INTO lab_service_costs (lab_name_id, work_type_code, cost_cents, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(lab_name_id, work_type_code) DO UPDATE SET
           cost_cents = excluded.cost_cents,
           updated_at = datetime('now')`,
      )
      .run(labNameId, workTypeCode, costCents);
    const row = this.db.connection
      .prepare('SELECT * FROM lab_service_costs WHERE lab_name_id = ? AND work_type_code = ?')
      .get(labNameId, workTypeCode) as Record<string, unknown>;
    return toCamel<LabServiceCost>(row);
  }

  remove(labNameId: number, workTypeCode: string): void {
    this.db.connection
      .prepare('DELETE FROM lab_service_costs WHERE lab_name_id = ? AND work_type_code = ?')
      .run(labNameId, workTypeCode);
  }
}
