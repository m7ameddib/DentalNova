import { isAxiosError } from 'axios';

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

/** Extracts a user-friendly message from an API error, falling back to a generic one. */
export function getErrorMessage(err: unknown, fallback: string): string {
  const fromBody = messageFromBody(responseData(err));
  if (fromBody) return fromBody;
  return fallback;
}
