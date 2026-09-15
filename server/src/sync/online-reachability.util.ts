/** User-facing copy when Offline Nest cannot complete an Online HTTP call. */

export const ONLINE_TIMEOUT_MESSAGE =
  'The Online clinic did not respond in time. Check the website address and this computer’s internet connection, then try again.';

export const ONLINE_UNREACHABLE_MESSAGE =
  'Could not reach the Online clinic. Check the website address, that the Online server is running, and this computer’s internet connection.';

export const ONLINE_TLS_MESSAGE =
  'Could not establish a secure HTTPS connection to the Online clinic. Check the website address.';

export const ONLINE_NOT_FOUND_MESSAGE =
  'The Online clinic address looks wrong (sync API was not found). Use the clinic website address, not a page path.';

export const ONLINE_SERVER_ERROR_MESSAGE =
  'The Online clinic had a server error. Check the pairing code and try again in a moment.';

export const ONLINE_UNAUTHORIZED_MESSAGE =
  'Invalid or expired pairing code, or this computer is not authorized to sync.';

export const GENERIC_UNEXPECTED_MESSAGE = 'Unexpected server error';

export function describeOnlineReachabilityError(err: unknown): string {
  const rec = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  const name = String(rec?.name || '');
  const message = String(rec?.message || '');
  const cause = `${rec?.cause?.code || ''} ${rec?.cause?.message || ''}`;
  const combined = `${name} ${message} ${cause}`.toLowerCase();

  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    combined.includes('aborted') ||
    combined.includes('timeout') ||
    combined.includes('timed out')
  ) {
    return ONLINE_TIMEOUT_MESSAGE;
  }
  if (
    combined.includes('cert') ||
    combined.includes('ssl') ||
    combined.includes('unable to verify') ||
    combined.includes('err_tls') ||
    combined.includes('self-signed')
  ) {
    return ONLINE_TLS_MESSAGE;
  }
  if (
    combined.includes('fetch failed') ||
    combined.includes('econnrefused') ||
    combined.includes('enotfound') ||
    combined.includes('eai_again') ||
    combined.includes('enetunreach') ||
    combined.includes('network') ||
    combined.includes('socket')
  ) {
    return ONLINE_UNREACHABLE_MESSAGE;
  }
  return ONLINE_UNREACHABLE_MESSAGE;
}

export function usefulOnlineMessage(message: unknown): string | null {
  if (typeof message === 'string' && message.trim() && message.trim() !== GENERIC_UNEXPECTED_MESSAGE) {
    return message.trim();
  }
  if (Array.isArray(message) && message.length > 0) {
    const joined = message.map((item) => String(item)).filter(Boolean).join(' ');
    return joined.trim() || null;
  }
  return null;
}

export function explainOnlineHttpStatus(status: number, fallback: string): string {
  if (status === 401 || status === 403) return ONLINE_UNAUTHORIZED_MESSAGE;
  if (status === 404) return ONLINE_NOT_FOUND_MESSAGE;
  if (status === 413) {
    return 'This sync request is too large for the Online server. It will be retried in smaller batches.';
  }
  if (status >= 500) return ONLINE_SERVER_ERROR_MESSAGE;
  return fallback;
}

export function friendlyStoredSyncError(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim();
  if (value === GENERIC_UNEXPECTED_MESSAGE || value === 'sync-failed') return ONLINE_SERVER_ERROR_MESSAGE;
  if (value === 'not-paired') {
    return 'This computer is not paired with an Online clinic yet. Enter the pairing code and connect first.';
  }
  if (value === 'bootstrap-required') {
    return 'This computer is paired but the first clinic download has not finished. Click Connect / bootstrap again.';
  }
  if (value === 'bootstrap-in-progress') {
    return 'The first download from the Online clinic is still in progress. Wait a moment, then click Sync now.';
  }
  if (value === 'device-auth-failed') {
    return 'This computer could not sign in to the Online clinic. Pair again with a new code if the device was revoked.';
  }
  const coded = /^(push|pull|snapshot|checkpoint)-failed-(\d+)$/.exec(value);
  if (coded) return explainOnlineHttpStatus(Number(coded[2]), ONLINE_SERVER_ERROR_MESSAGE);
  return value;
}

export function messageFromOnlineResponse(
  status: number,
  body: { message?: unknown } | null | undefined,
  fallback: string,
): string {
  const useful = usefulOnlineMessage(body?.message);
  if (useful) return useful;
  return explainOnlineHttpStatus(status, fallback);
}
