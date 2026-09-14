import * as fs from 'fs';
import * as path from 'path';

export const RATE_LIMIT_FILE = 'auth-rate-limit.json';
export const RATE_LIMIT_SCHEMA = 1;

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface PersistedStore {
  v: number;
  buckets: Record<string, RateLimitWindow>;
}

export function rateLimitFilePath(configDir: string): string {
  return path.join(configDir, RATE_LIMIT_FILE);
}

export function loadRateLimitWindows(file: string, now = Date.now()): Map<string, RateLimitWindow> {
  const windows = new Map<string, RateLimitWindow>();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as PersistedStore;
    if (parsed?.v !== RATE_LIMIT_SCHEMA || !parsed.buckets || typeof parsed.buckets !== 'object') {
      return windows;
    }
    for (const [key, value] of Object.entries(parsed.buckets)) {
      if (
        value &&
        typeof value.count === 'number' &&
        typeof value.resetAt === 'number' &&
        value.resetAt > now &&
        value.count >= 0
      ) {
        windows.set(key, { count: value.count, resetAt: value.resetAt });
      }
    }
  } catch {
    /* missing or corrupt file → empty in-memory windows */
  }
  return windows;
}

/** Atomic replace so a crash mid-write cannot leave a truncated counters file. */
export function saveRateLimitWindows(file: string, windows: Map<string, RateLimitWindow>, now = Date.now()): void {
  const buckets: Record<string, RateLimitWindow> = {};
  for (const [key, value] of windows) {
    if (value.resetAt > now && value.count > 0) {
      buckets[key] = { count: value.count, resetAt: value.resetAt };
    }
  }
  const payload = JSON.stringify({ v: RATE_LIMIT_SCHEMA, buckets } satisfies PersistedStore);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows may ignore chmod */
  }
}
