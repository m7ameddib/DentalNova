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

export async function withRetries<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 120): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw last;
}
