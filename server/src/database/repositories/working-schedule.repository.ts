import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';

export interface WorkingPeriod {
  id?: number;
  startTime: string;
  endTime: string;
  sortOrder?: number;
}

export interface WeeklyDaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  periods: WorkingPeriod[];
}

export interface ScheduleException {
  id: number;
  exceptionDate: string;
  isClosed: boolean;
  note: string | null;
  periods: WorkingPeriod[];
  createdAt: string;
  updatedAt: string;
}

export interface DayScheduleResolved {
  date: string;
  isClosed: boolean;
  isException: boolean;
  exceptionNote: string | null;
  periods: WorkingPeriod[];
}

@Injectable()
export class WorkingScheduleRepository {
  constructor(private readonly db: DatabaseService) {}

  getWeeklySchedule(): WeeklyDaySchedule[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM clinic_weekly_periods ORDER BY day_of_week ASC, sort_order ASC, id ASC`,
      )
      .all() as Record<string, unknown>[];

    const byDay = new Map<number, WorkingPeriod[]>();
    for (const row of rows) {
      const p = toCamel<WorkingPeriod & { dayOfWeek: number }>(row);
      const list = byDay.get(p.dayOfWeek) ?? [];
      list.push({ id: p.id, startTime: p.startTime, endTime: p.endTime, sortOrder: p.sortOrder });
      byDay.set(p.dayOfWeek, list);
    }

    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      const periods = byDay.get(dayOfWeek) ?? [];
      return { dayOfWeek, isOpen: periods.length > 0, periods };
    });
  }

  saveWeeklySchedule(days: WeeklyDaySchedule[]): void {
    const tx = this.db.connection.transaction((schedule: WeeklyDaySchedule[]) => {
      this.db.connection.prepare('DELETE FROM clinic_weekly_periods').run();
      const insert = this.db.connection.prepare(
        `INSERT INTO clinic_weekly_periods (day_of_week, start_time, end_time, sort_order) VALUES (?, ?, ?, ?)`,
      );
      for (const day of schedule) {
        if (!day.isOpen || day.periods.length === 0) continue;
        day.periods.forEach((p, idx) => {
          insert.run(day.dayOfWeek, p.startTime, p.endTime, p.sortOrder ?? idx);
        });
      }
      this.syncLegacySettings(schedule);
    });
    tx(days);
  }

  /** Keep legacy columns in sync for any code still reading them. */
  private syncLegacySettings(days: WeeklyDaySchedule[]): void {
    const openDays = days.filter((d) => d.isOpen && d.periods.length > 0);
    const workingDays = openDays.map((d) => d.dayOfWeek).sort().join(',') || '0';
    let minStart = '09:00';
    let maxEnd = '18:00';
    if (openDays.length > 0) {
      const allStarts = openDays.flatMap((d) => d.periods.map((p) => p.startTime));
      const allEnds = openDays.flatMap((d) => d.periods.map((p) => p.endTime));
      minStart = allStarts.sort()[0];
      maxEnd = allEnds.sort().slice(-1)[0];
    }
    this.db.connection
      .prepare(
        `UPDATE clinic_settings SET working_days = ?, work_start_time = ?, work_end_time = ?, updated_at = datetime('now') WHERE id = 1`,
      )
      .run(workingDays, minStart, maxEnd);
  }

  listExceptions(): ScheduleException[] {
    const rows = this.db.connection
      .prepare(`SELECT * FROM clinic_schedule_exceptions ORDER BY exception_date ASC`)
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapException(row));
  }

  findExceptionByDate(date: string): ScheduleException | undefined {
    const row = this.db.connection
      .prepare(`SELECT * FROM clinic_schedule_exceptions WHERE exception_date = ?`)
      .get(date) as Record<string, unknown> | undefined;
    return row ? this.mapException(row) : undefined;
  }

  findExceptionById(id: number): ScheduleException | undefined {
    const row = this.db.connection
      .prepare(`SELECT * FROM clinic_schedule_exceptions WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapException(row) : undefined;
  }

  createException(input: {
    exceptionDate: string;
    isClosed: boolean;
    note?: string | null;
    periods?: WorkingPeriod[];
  }): ScheduleException {
    const result = this.db.connection
      .prepare(
        `INSERT INTO clinic_schedule_exceptions (exception_date, is_closed, note) VALUES (?, ?, ?)`,
      )
      .run(input.exceptionDate, input.isClosed ? 1 : 0, input.note ?? null);
    const id = Number(result.lastInsertRowid);
    if (!input.isClosed && input.periods?.length) {
      this.replaceExceptionPeriods(id, input.periods);
    }
    return this.findExceptionById(id)!;
  }

  updateException(
    id: number,
    input: { isClosed?: boolean; note?: string | null; periods?: WorkingPeriod[] },
  ): ScheduleException | undefined {
    const existing = this.findExceptionById(id);
    if (!existing) return undefined;
    const isClosed = input.isClosed !== undefined ? input.isClosed : existing.isClosed;
    const note = input.note !== undefined ? input.note : existing.note;
    this.db.connection
      .prepare(
        `UPDATE clinic_schedule_exceptions SET is_closed = ?, note = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(isClosed ? 1 : 0, note, id);
    if (input.periods !== undefined) {
      this.replaceExceptionPeriods(id, isClosed ? [] : input.periods);
    } else if (isClosed) {
      this.replaceExceptionPeriods(id, []);
    }
    return this.findExceptionById(id);
  }

  deleteException(id: number): boolean {
    const result = this.db.connection
      .prepare(`DELETE FROM clinic_schedule_exceptions WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  getDisplayTimeRange(): { startTime: string; endTime: string } {
    const weekly = this.getWeeklySchedule();
    const exceptionRows = this.db.connection
      .prepare(`SELECT start_time, end_time FROM clinic_exception_periods`)
      .all() as { start_time: string; end_time: string }[];

    const starts: string[] = [];
    const ends: string[] = [];
    for (const day of weekly) {
      for (const p of day.periods) {
        starts.push(p.startTime);
        ends.push(p.endTime);
      }
    }
    for (const p of exceptionRows) {
      starts.push(p.start_time);
      ends.push(p.end_time);
    }

    if (starts.length === 0) {
      const settings = this.db.connection
        .prepare(`SELECT work_start_time, work_end_time FROM clinic_settings WHERE id = 1`)
        .get() as { work_start_time: string; work_end_time: string } | undefined;
      return {
        startTime: settings?.work_start_time ?? '09:00',
        endTime: settings?.work_end_time ?? '18:00',
      };
    }

    const minStart = starts.sort()[0];
    const maxEnd = ends.sort().slice(-1)[0];
    return {
      startTime: minStart,
      endTime: minutesToTime(Math.min(24 * 60 - 30, timeToMinutes(maxEnd) + 60)),
    };
  }

  private replaceExceptionPeriods(exceptionId: number, periods: WorkingPeriod[]): void {
    this.db.connection
      .prepare(`DELETE FROM clinic_exception_periods WHERE exception_id = ?`)
      .run(exceptionId);
    const insert = this.db.connection.prepare(
      `INSERT INTO clinic_exception_periods (exception_id, start_time, end_time, sort_order) VALUES (?, ?, ?, ?)`,
    );
    periods.forEach((p, idx) => insert.run(exceptionId, p.startTime, p.endTime, p.sortOrder ?? idx));
  }

  private mapException(row: Record<string, unknown>): ScheduleException {
    const mapped = toCamel<ScheduleException>(row);
    mapped.isClosed = Boolean(row.is_closed);
    const periodRows = this.db.connection
      .prepare(
        `SELECT * FROM clinic_exception_periods WHERE exception_id = ? ORDER BY sort_order ASC, id ASC`,
      )
      .all(mapped.id) as Record<string, unknown>[];
    mapped.periods = toCamelList<WorkingPeriod>(periodRows);
    return mapped;
  }
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
