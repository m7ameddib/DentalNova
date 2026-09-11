import { AppointmentStatus, AppointmentWithPatient } from '@/types/domain';
import { timeToMinutes } from '@/utils/calendar';

export type CalendarViewMode = 'week' | 'month';

export const EMERGENCY_TYPE = 'EMERGENCY';

export const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90] as const;
export const DEFAULT_DURATION = 30;

export const ROW_HEIGHT_PX_30 = 82;
export const ROW_HEIGHT_PX_15 = 41;
export const MOBILE_ROW_HEIGHT_PX_30 = 44;
export const MOBILE_ROW_HEIGHT_PX_15 = 24;
export const CALENDAR_HEADER_ROW_PX = 54;
export const CALENDAR_TIME_COLUMN_PX = 100;
export const CALENDAR_MOBILE_TIME_COLUMN_PX = 32;
export const CALENDAR_MOBILE_DAY_COLUMN_PX = 136;
export const CALENDAR_MOBILE_BREAKPOINT = '(max-width: 768px)';
export const CALENDAR_MIN_CARD_HEIGHT_PX = 32;
export const CALENDAR_MOBILE_MIN_CARD_HEIGHT_PX = 18;
export const DRAG_THRESHOLD_PX = 6;

export const CALENDAR_STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'WAITING',
  'IN_TREATMENT',
  'CANCELLED',
];

export const EMERGENCY_STATUS_OPTIONS: AppointmentStatus[] = ['WAITING', 'IN_TREATMENT', 'COMPLETED'];

export const ALL_STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'WAITING',
  'IN_TREATMENT',
  'COMPLETED',
  'CANCELLED',
];

export function isEmergencyAppointment(appointment: { appointmentType: string }): boolean {
  return appointment.appointmentType === EMERGENCY_TYPE;
}

export function snapDuration(minutes: number): number {
  const snapped = Math.round(minutes / 5) * 5;
  return Math.max(5, Math.min(180, snapped));
}

export function snapMinute(minute: number, step = 5): number {
  return Math.round(minute / step) * step;
}

/** True when [startMinute, startMinute + duration) intersects another active appointment. */
export function appointmentOverlaps(
  appointments: AppointmentWithPatient[],
  startMinute: number,
  durationMin: number,
  excludeId?: number,
): boolean {
  const newStart = startMinute;
  const newEnd = startMinute + durationMin;
  return appointments.some((a) => {
    if (excludeId != null && a.id === excludeId) return false;
    if (isEmergencyAppointment(a)) return false;
    if (a.status === 'CANCELLED') return false;
    const start = timeToMinutes(a.time);
    const end = start + (a.durationMin || DEFAULT_DURATION);
    return newStart < end && start < newEnd;
  });
}
