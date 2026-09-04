import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { LabWorkType } from '../../common/types';

@Injectable()
export class LabWorkTypesRepository {
  constructor(private readonly db: DatabaseService) {}

  findAllActive(): LabWorkType[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM lab_work_types WHERE is_active = 1 ORDER BY sort_order, label')
      .all() as Record<string, unknown>[];
    return toCamelList<LabWorkType>(rows);
  }

  findByCode(code: string): LabWorkType | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM lab_work_types WHERE code = ?')
      .get(code) as Record<string, unknown> | undefined;
    return row ? toCamel<LabWorkType>(row) : undefined;
  }
}
