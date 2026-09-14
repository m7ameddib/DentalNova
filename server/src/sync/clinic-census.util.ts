import Database from 'better-sqlite3';

/** Clinic-owned operational tables. Catalogs (treatment types, etc.) do not count as populated. */
export const OPERATIONAL_TABLES = [
  'patients',
  'payments',
  'patient_treatments',
  'appointments',
  'clinic_expenses',
  'lab_cases',
  'prescriptions',
  'clinical_visit_notes',
] as const;

export type ClinicCensus = {
  counts: Record<string, number>;
  total: number;
  populated: boolean;
};

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table);
  return Boolean(row);
}

export function clinicOperationalCensus(db: Database.Database): ClinicCensus {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const table of OPERATIONAL_TABLES) {
    if (!tableExists(db, table)) {
      counts[table] = 0;
      continue;
    }
    const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    const where = cols.includes('archived_at') ? `WHERE archived_at IS NULL` : '';
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get() as { c: number };
    const n = Number(row?.c ?? 0);
    counts[table] = n;
    total += n;
  }
  return { counts, total, populated: total > 0 };
}

export const POPULATED_OFFLINE_CODE = 'POPULATED_OFFLINE_BLOCKED';

export function populatedOfflineMessage(census: ClinicCensus): string {
  return (
    'This Offline installation already has clinic records ' +
    `(patients=${census.counts.patients ?? 0}, payments=${census.counts.payments ?? 0}, ` +
    `treatments=${census.counts.patient_treatments ?? 0}, appointments=${census.counts.appointments ?? 0}). ` +
    'Automatic pairing only supports an EMPTY Offline install connected to an existing Online clinic. ' +
    'Do not merge two independent databases. Use Backup & Restore or a support-assisted migration.'
  );
}
