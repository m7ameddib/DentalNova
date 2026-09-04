import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DayScheduleResolved,
  minutesToTime,
  timeToMinutes,
  WorkingPeriod,
  WorkingScheduleRepository,
  WeeklyDaySchedule,
} from '../database/repositories/working-schedule.repository';
import { ScheduleException } from '../database/repositories/working-schedule.repository';

export const SLOT_STEP_MIN = 30;

@Injectable()
export class WorkingScheduleService {
  constructor(private readonly repo: WorkingScheduleRepository) {}

  getWeeklySchedule(): WeeklyDaySchedule[] {
    return this.repo.getWeeklySchedule();
  }

  saveWeeklySchedule(days: WeeklyDaySchedule[]): WeeklyDaySchedule[] {
    this.validateWeeklySchedule(days);
    this.repo.saveWeeklySchedule(days);
    return this.repo.getWeeklySchedule();
  }

  listExceptions(): ScheduleException[] {
    return this.repo.listExceptions();
  }

  createException(input: {
    exceptionDate: string;
    isClosed: boolean;
    note?: string | null;
    periods?: WorkingPeriod[];
  }): ScheduleException {
    if (!input.isClosed && (!input.periods || input.periods.length === 0)) {
      throw new BadRequestException('Open exceptions require at least one working period');
    }
    if (input.periods) this.validatePeriods(input.periods);
    return this.repo.createException(input);
  }

  updateException(
    id: number,
    input: { isClosed?: boolean; note?: string | null; periods?: WorkingPeriod[] },
  ): ScheduleException {
    if (input.periods) this.validatePeriods(input.periods);
    const updated = this.repo.updateException(id, input);
    if (!updated) throw new BadRequestException('Exception not found');
    return updated;
  }

  deleteException(id: number): { id: number } {
    if (!this.repo.deleteException(id)) throw new BadRequestException('Exception not found');
    return { id };
  }

  resolveForDate(date: string): DayScheduleResolved {
    const exception = this.repo.findExceptionByDate(date);
    if (exception) {
      return {
        date,
        isClosed: exception.isClosed,
        isException: true,
        exceptionNote: exception.note,
        periods: exception.isClosed ? [] : exception.periods,
      };
    }
    const dayOfWeek = this.weekdayOf(date);
    const weekly = this.repo.getWeeklySchedule();
    const day = weekly.find((d) => d.dayOfWeek === dayOfWeek);
    const periods = day?.isOpen ? day.periods : [];
    return {
      date,
      isClosed: periods.length === 0,
      isException: false,
      exceptionNote: null,
      periods,
    };
  }

  isWithinWorkingHours(date: string, time: string, durationMin: number): boolean {
    const resolved = this.resolveForDate(date);
    if (resolved.isClosed || resolved.periods.length === 0) return false;
    const start = timeToMinutes(time);
    const end = start + durationMin;
    return resolved.periods.some((p) => {
      const pStart = timeToMinutes(p.startTime);
      const pEnd = timeToMinutes(p.endTime);
      return start >= pStart && end <= pEnd;
    });
  }

  buildSlotsForDate(date: string): { time: string; withinWorkingHours: boolean }[] {
    const { startTime, endTime } = this.repo.getDisplayTimeRange();
    const resolved = this.resolveForDate(date);
    const slots: { time: string; withinWorkingHours: boolean }[] = [];
    let cursor = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    while (cursor < end) {
      const time = minutesToTime(cursor);
      const within = !resolved.isClosed && this.isIntervalWithinPeriods(cursor, cursor + SLOT_STEP_MIN, resolved.periods);
      slots.push({ time, withinWorkingHours: within });
      cursor += SLOT_STEP_MIN;
    }
    return slots;
  }

  private isIntervalWithinPeriods(startMin: number, endMin: number, periods: WorkingPeriod[]): boolean {
    return periods.some((p) => {
      const pStart = timeToMinutes(p.startTime);
      const pEnd = timeToMinutes(p.endTime);
      return startMin >= pStart && endMin <= pEnd;
    });
  }

  private weekdayOf(dateIso: string): number {
    return new Date(`${dateIso}T00:00:00`).getDay();
  }

  private validateWeeklySchedule(days: WeeklyDaySchedule[]): void {
    if (days.length !== 7) throw new BadRequestException('Schedule must include all 7 weekdays');
    for (const day of days) {
      if (day.isOpen) {
        if (!day.periods.length) throw new BadRequestException(`Day ${day.dayOfWeek} is open but has no periods`);
        this.validatePeriods(day.periods);
      }
    }
  }

  private validatePeriods(periods: WorkingPeriod[]): void {
    for (const p of periods) {
      if (timeToMinutes(p.startTime) >= timeToMinutes(p.endTime)) {
        throw new BadRequestException('Period end time must be after start time');
      }
    }
  }
}
