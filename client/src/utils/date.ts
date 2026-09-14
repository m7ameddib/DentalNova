export function todayIso(): string {
  return localTodayIso();
}

/** Round local clock time to the nearest 5 minutes, carrying the hour when needed. */
export function currentTimeRounded(): string {
  const now = new Date();
  let minutes = Math.round(now.getMinutes() / 5) * 5;
  let hours = now.getHours();
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Local calendar date (YYYY-MM-DD) for the clinic computer. */
export function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(dateIso: string, delta: number): string {
  return localAddDaysIso(dateIso, delta);
}

/** First day of the clinic-local month (YYYY-MM-01). */
export function localMonthStartIso(from: Date = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function localAddDaysIso(dateIso: string, delta: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function calculateAge(dateOfBirthIso: string): number {
  const [y, m, d] = dateOfBirthIso.split('-').map(Number);
  const dob = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** Shared Intl options so every user-visible clock uses 12-hour AM/PM (ص/م in Arabic). */
export const TIME_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

const CLOCK_TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** True when a value is a stored 24h clock string such as "16:00" or "9:15". */
export function isStoredClockTime(value: string): boolean {
  return CLOCK_TIME_RE.test(value.trim());
}

/** Formats a stored 24h "HH:mm" clock value for display (12-hour AM/PM). */
export function formatClockTime(time: string, locale: string): string {
  const match = CLOCK_TIME_RE.exec(time.trim());
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return time;
  }
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(locale, TIME_DISPLAY_OPTIONS);
}

/** Formats HH:mm values in AI/assistant display maps; leaves other strings unchanged. */
export function formatDisplayTimeValue(value: string, locale: string): string {
  return isStoredClockTime(value) ? formatClockTime(value, locale) : value;
}

export function formatTimeDisplay(isoTimestamp: string, locale: string): string {
  try {
    return new Date(isoTimestamp.replace(' ', 'T') + 'Z').toLocaleTimeString(locale, TIME_DISPLAY_OPTIONS);
  } catch {
    return isoTimestamp;
  }
}

export function formatDateDisplay(dateIso: string, locale: string): string {
  try {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateIso;
  }
}

/** Formats a full ISO timestamp (e.g. a treatment's createdAt) for display. */
export function formatDateTimeDisplay(isoTimestamp: string, locale: string): string {
  if (!isoTimestamp) return '';
  const normalized = isoTimestamp.includes('T') ? isoTimestamp : isoTimestamp.replace(' ', 'T');
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized);
  const parsed = new Date(hasZone ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...TIME_DISPLAY_OPTIONS,
  });
}
