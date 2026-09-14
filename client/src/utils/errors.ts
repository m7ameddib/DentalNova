import { isAxiosError } from 'axios';

function responseData(err: unknown): Record<string, unknown> | null {
  if (!isAxiosError(err) || !err.response?.data || typeof err.response.data !== 'object') return null;
  return err.response.data as Record<string, unknown>;
}

/** Machine code from API errors (e.g. POPULATED_OFFLINE_BLOCKED). */
export function getApiErrorCode(err: unknown): string | undefined {
  const data = responseData(err);
  return typeof data?.code === 'string' ? data.code : undefined;
}

/** Extracts a user-friendly message from an API error, falling back to a generic one. */
export function getErrorMessage(err: unknown, fallback: string): string {
  const data = responseData(err);
  const message = data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string' && message[0].trim()) return message[0];
  if (isAxiosError(err) && typeof err.response?.data?.message === 'string') {
    return err.response.data.message;
  }
  return fallback;
}
