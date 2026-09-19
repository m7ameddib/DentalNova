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

/**
 * Formats a stored 24-hour `HH:mm` appointment time for reminder message text only
 * (e.g. 16:00 → 4:00 PM). Does not change database storage or scheduling values.
 *
 * Must never throw: it runs inside the WhatsApp reminder click handler before
 * `window.open` / `wa.me`, so a TypeError on `.trim()` would swallow the open.
 */
export function formatReminderClockTime(time: string | null | undefined): string {
  if (time == null) return '';
  const raw = String(time).trim();
  if (!raw) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
  if (!match) return raw;
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23 || Number(minute) > 59) return raw;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatTimeDisplay(isoTimestamp: string, locale: string): string {
  try {
    return new Date(isoTimestamp.replace(' ', 'T') + 'Z').toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
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

/** Patient date of birth display — always DD/MM/YYYY regardless of UI locale. */
export function formatDobDisplay(dateIso: string): string {
  if (!dateIso) return '';
  const [year, month, day] = dateIso.split('-');
  if (!year || !month || !day) return dateIso;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

/** Parse DD/MM/YYYY (or D/M/YYYY) into stored ISO YYYY-MM-DD. Returns null when invalid. */
export function parseDobDisplay(dmy: string): string | null {
  const trimmed = dmy.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > lastDay) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Mask typed digits into DD/MM/YYYY for a single date-of-birth input. */
export function maskDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
    hour: '2-digit',
    minute: '2-digit',
  });
}
