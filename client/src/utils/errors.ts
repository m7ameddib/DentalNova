import { isAxiosError } from 'axios';

export const OPAQUE_SERVER_ERROR = 'Unexpected server error';

function responseData(err: unknown): Record<string, unknown> | null {
  if (!isAxiosError(err) || !err.response?.data || typeof err.response.data !== 'object') return null;
  return err.response.data as Record<string, unknown>;
}

function messageFromBody(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const message = (data as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length > 0) {
    return message.map((item) => String(item)).filter(Boolean).join(' ');
  }
  return null;
}

/** Machine code from API errors (e.g. POPULATED_OFFLINE_BLOCKED). */
export function getApiErrorCode(err: unknown): string | undefined {
  const data = responseData(err);
  return typeof data?.code === 'string' ? data.code : undefined;
}

function networkFailureMessage(err: unknown): string | null {
  if (!isAxiosError(err)) return null;
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
    return 'The request timed out. The Online clinic may be slow or unreachable.';
  }
  if (!err.response) {
    return 'Could not reach the clinic server. Check that DentalNova is running and the internet connection is working.';
  }
  return null;
}

/** Extracts a user-friendly message from an API error, falling back to a generic one. */
export function getErrorMessage(err: unknown, fallback: string): string {
  const fromBody = messageFromBody(responseData(err));
  if (fromBody && fromBody !== OPAQUE_SERVER_ERROR) return fromBody;
  const network = networkFailureMessage(err);
  if (network) return network;
  return fallback;
}
