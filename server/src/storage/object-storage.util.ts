export function normalizeRelativeStoragePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function r2ObjectKey(relativePath: string, clinicId: string | null | undefined, prefix = ''): string {
  const trimmed = normalizeRelativeStoragePath(relativePath);
  const tenant = (clinicId || 'offline-local').replace(/[^a-zA-Z0-9._-]/g, '_');
  const namespaced = `${tenant}/${trimmed}`;
  const pre = prefix.replace(/\/+$/, '');
  return pre ? `${pre}/${namespaced}` : namespaced;
}

/** True for missing objects, not credential/outage failures. */
export function isObjectNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { name?: unknown; Code?: unknown; $metadata?: { httpStatusCode?: unknown }; message?: unknown };
  const name = String(rec.name || rec.Code || '');
  if (name === 'NoSuchKey' || name === 'NotFound') return true;
  if (Number(rec.$metadata?.httpStatusCode) === 404) return true;
  return /NoSuchKey|NotFound|status code 404/i.test(String(rec.message || ''));
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 120,
  isRetryable?: (err: unknown) => boolean,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (isRetryable && !isRetryable(err)) throw err;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw last;
}

/** High-water mark so a retried chunk does not double-count received bytes. */
export function partialReceivedHighWater(previousReceived: number, offset: number, chunkLength: number): number {
  return Math.max(Math.max(0, Number(previousReceived) || 0), offset + chunkLength);
}

/** Online must not keep a local file that failed to land in R2 (orphan / false cache). */
export function keepLocalCopyAfterRemoteFailure(isOnline: boolean): boolean {
  return !isOnline;
}
