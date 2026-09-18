/**
 * Sequential patient file numbers (P-000001). Always use the numeric MAX
 * across existing values — never the last autoincrement id — so deleted or
 * out-of-order rows cannot collide with UNIQUE(file_number).
 */
export function maxPatientFileSeq(db: { prepare: (sql: string) => { all: () => unknown[] } }): number {
  const rows = db.prepare(`SELECT file_number AS fileNumber FROM patients`).all() as Array<{
    fileNumber?: string | null;
  }>;
  let max = 0;
  for (const row of rows) {
    const digits = String(row.fileNumber ?? '').replace(/\D/g, '');
    if (!digits) continue;
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function nextPatientFileNumber(db: { prepare: (sql: string) => { all: () => unknown[] } }): string {
  return `P-${String(maxPatientFileSeq(db) + 1).padStart(6, '0')}`;
}

export function isFileNumberCollision(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: unknown; message?: unknown };
  const code = String(rec.code || '');
  const message = String(rec.message || '');
  return (
    (code.startsWith('SQLITE_CONSTRAINT') || message.includes('SQLITE_CONSTRAINT')) &&
    message.includes('file_number')
  );
}
