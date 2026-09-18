const PAIRING_TABLE = 'sync_pairing_codes';
const INVITE_TABLE = 'clinic_signup_invites';

/**
 * Atomically mark a hashed one-time row used. A second caller with the same
 * hash sees `changes === 0` even under concurrent writers — SQLite serializes
 * the UPDATE, and `used_at IS NULL` allows only one winner.
 */
export function consumeHashedOneTimeRow(
  db: {
    prepare: (sql: string) => {
      run: (...params: any[]) => { changes: number };
      get: (...params: any[]) => any;
    };
  },
  input: {
    table: typeof PAIRING_TABLE | typeof INVITE_TABLE;
    hash: string;
    nowIso: string;
  },
): { clinicId: string | null } | null {
  const table = input.table === PAIRING_TABLE ? PAIRING_TABLE : INVITE_TABLE;
  const result = db
    .prepare(
      `UPDATE ${table} SET used_at = datetime('now')
       WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .run(input.hash, input.nowIso);
  if (result.changes !== 1) return null;
  if (table === PAIRING_TABLE) {
    const row = db.prepare(`SELECT clinic_id AS clinicId FROM ${table} WHERE code_hash = ?`).get(input.hash) as
      | { clinicId?: unknown }
      | undefined;
    return { clinicId: row?.clinicId != null ? String(row.clinicId) : null };
  }
  return { clinicId: null };
}
