/** Local calendar date helpers (clinic computer timezone). */

export function localTodayIso(): string {
  const now = new Date();
  return formatLocalDateIso(now);
}

export function addLocalDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalDateIso(dt);
}

function formatLocalDateIso(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** UTC datetime bounds matching a local calendar day (for SQLite UTC created_at values). */
export function localDayUtcBounds(dateIso: string): { start: string; endExclusive: string } {
  const [y, m, d] = dateIso.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const toSqlUtc = (dt: Date) => dt.toISOString().slice(0, 19).replace('T', ' ');
  return { start: toSqlUtc(start), endExclusive: toSqlUtc(end) };
}
