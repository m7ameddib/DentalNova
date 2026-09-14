import { isAxiosError } from 'axios';

function messageFromBody(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const message = (data as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length > 0) {
    return message.map((item) => String(item)).filter(Boolean).join(' ');
  }
  return null;
}

/** Extracts a user-friendly message from an API error, falling back to a generic one. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const fromBody = messageFromBody(err.response?.data);
    if (fromBody) return fromBody;
  }
  return fallback;
}
