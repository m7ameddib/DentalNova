const WINDOW_MS = 4000;
const recent = new Map<string, { key: string; expires: number }>();

function stableBody(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/** Same mutating request within 4s reuses the key (double-click / retry). Distinct payloads get a new key. */
export function idempotencyKeyFor(method: string, url: string, data: unknown): string | undefined {
  const verb = method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)) return undefined;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return undefined;
  const fingerprint = `${verb}:${url}:${stableBody(data)}`;
  const now = Date.now();
  const hit = recent.get(fingerprint);
  if (hit && hit.expires > now) return hit.key;
  const key =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `idem-${now}-${Math.random().toString(16).slice(2)}`;
  recent.set(fingerprint, { key, expires: now + WINDOW_MS });
  return key;
}
