/** Orchestration helpers for Offline bootstrap / token refresh — kept pure for unit tests. */

export const DEVICE_TOKEN_REFRESH_AFTER_MS = 60 * 60 * 1000;

export function shouldRefreshDeviceToken(issuedAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return true;
  return nowMs - issuedAtMs >= DEVICE_TOKEN_REFRESH_AFTER_MS;
}

export function shouldRunBootstrapBeforeCycle(bootstrappedAt: string | null | undefined): boolean {
  return !bootstrappedAt;
}

export function canResumeIncompleteBootstrap(input: {
  bootstrappedAt?: string | null;
  bootstrapStarted?: string | null;
}): boolean {
  if (input.bootstrappedAt) return false;
  return input.bootstrapStarted === '1';
}

/**
 * Snapshot pages must pin the Online change-log seq from the FIRST page.
 * Using the last page's maxSeq skips rows written while bootstrap was running.
 */
export function rememberOpeningCheckpoint(
  already: number | undefined,
  pageCheckpoint: number | undefined,
): number | undefined {
  if (already != null && Number.isFinite(already)) return already;
  if (pageCheckpoint != null && Number.isFinite(pageCheckpoint)) return pageCheckpoint;
  return already;
}

export function remoteRowFromConflictJson(remote: unknown): Record<string, unknown> | null {
  if (!remote || typeof remote !== 'object') return null;
  const obj = remote as Record<string, unknown>;
  if (obj.row && typeof obj.row === 'object' && !Array.isArray(obj.row)) {
    return obj.row as Record<string, unknown>;
  }
  return obj;
}
