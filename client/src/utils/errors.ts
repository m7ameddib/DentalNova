import { isAxiosError } from 'axios';

/** Extracts a user-friendly message from an API error, falling back to a generic one. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.message === 'string') {
    return err.response.data.message;
  }
  return fallback;
}
