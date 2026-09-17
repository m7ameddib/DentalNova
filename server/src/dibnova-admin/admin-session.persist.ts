import * as fs from 'fs';
import * as path from 'path';

export const ADMIN_REVOKED_FILE = 'admin-revoked-jti.json';
export const ADMIN_REVOKED_SCHEMA = 1;

interface PersistedStore {
  v: number;
  revoked: Record<string, number>;
}

export function adminRevokedFilePath(configDir: string): string {
  return path.join(configDir, ADMIN_REVOKED_FILE);
}

export function loadRevokedAdminJti(file: string, now = Date.now()): Map<string, number> {
  const revoked = new Map<string, number>();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as PersistedStore;
    if (parsed?.v !== ADMIN_REVOKED_SCHEMA || !parsed.revoked || typeof parsed.revoked !== 'object') {
      return revoked;
    }
    for (const [jti, expMs] of Object.entries(parsed.revoked)) {
      if (typeof expMs === 'number' && expMs > now && jti.trim()) {
        revoked.set(jti.trim(), expMs);
      }
    }
  } catch {
    /* missing or corrupt → empty */
  }
  return revoked;
}

export function saveRevokedAdminJti(file: string, revoked: Map<string, number>, now = Date.now()): void {
  const payload: PersistedStore = { v: ADMIN_REVOKED_SCHEMA, revoked: {} };
  for (const [jti, expMs] of revoked) {
    if (expMs > now) payload.revoked[jti] = expMs;
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows may ignore chmod */
  }
}
