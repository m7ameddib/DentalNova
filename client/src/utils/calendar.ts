/** Formats using local date components (never toISOString, which shifts to UTC and can roll the date). */
function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Days to subtract from a date to reach Monday (week starts Mon, ends Sun). */
function weekStartOffset(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

export interface WeekDay {
  iso: string;
  day: number;
  weekday: string;
  isToday: boolean;
}

/** Returns the ISO date of the Monday starting the week that contains the given ISO date. */
export function startOfWeekIso(dateIso: string, _locale?: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() - weekStartOffset(d));
  return toIso(d);
}

/** Monday-first month grid used by month and mini calendars. */
export function buildMondayFirstMonthGrid(year: number, monthIndex: number): (string | null)[][] {
  const first = new Date(year, monthIndex, 1);
  const startPad = weekStartOffset(first);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const m = (monthIndex + 1).toString().padStart(2, '0');
    const day = d.toString().padStart(2, '0');
    cells.push(`${year}-${m}-${day}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Weekday labels Mon–Sun for the given locale. Jan 1 2024 is a Monday. */
export function mondayFirstWeekdayLabels(locale: string, weekday: 'short' | 'narrow' = 'short'): string[] {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString(locale, { weekday });
  });
}

/** Builds the 7 days of the week starting at weekStartIso. */
export function buildWeekDays(weekStartIso: string, locale: string): WeekDay[] {
  const todayIso = toIso(new Date());
  const start = new Date(`${weekStartIso}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toIso(d);
    return {
      iso,
      day: d.getDate(),
      weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
      isToday: iso === todayIso,
    };
  });
}

/** "HH:mm" -> minutes since midnight. Used for variable-duration appointment positioning. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight -> "HH:mm". Inverse of `timeToMinutes`. */
export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Formats a 24h "HH:mm" clock value for display. */
export function formatClockTime(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** Expands 30-minute slot labels to 15-minute steps when needed. */
export function expandSlotTimes(times: string[], slotStepMin: 15 | 30): string[] {
  if (slotStepMin === 30 || times.length === 0) return times;
  const out: string[] = [];
  for (const t of times) {
    out.push(t);
    out.push(minutesToTime(timeToMinutes(t) + 15));
  }
  return out;
}

interface ScheduleSlotLike {
  time: string;
  withinWorkingHours?: boolean;
}

/** Drop grid rows before the earliest working-hours slot in the visible week. */
export function trimTimesFromWorkingDayStart(
  times: string[],
  schedules: { slots?: ScheduleSlotLike[] }[],
  fallbackStartTime = '09:00',
): string[] {
  if (times.length === 0) return times;

  let earliestWorking: number | null = null;
  for (const schedule of schedules) {
    for (const slot of schedule.slots ?? []) {
      if (slot.withinWorkingHours) {
        const minutes = timeToMinutes(slot.time);
        if (earliestWorking === null || minutes < earliestWorking) {
          earliestWorking = minutes;
        }
      }
    }
  }

  const cutoff = earliestWorking ?? timeToMinutes(fallbackStartTime);
  return times.filter((t) => timeToMinutes(t) >= cutoff);
}

/** Human-readable label for the span of a week, e.g. "Aug 10 – 16, 2026". */
export function weekRangeLabel(weekStartIso: string, locale: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}
