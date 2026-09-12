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
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
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
  const dob = new Date(dateOfBirthIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
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

/** Formats a full ISO timestamp (e.g. a treatment's createdAt) for display. */
export function formatDateTimeDisplay(isoTimestamp: string, locale: string): string {
  try {
    return new Date(isoTimestamp.replace(' ', 'T') + 'Z').toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoTimestamp;
  }
}
