export const FALLBACK_TOKEN_KEY = 'dnt-dental-token';
export const FALLBACK_USER_KEY = 'dnt-dental-user';

export type SessionPersistTarget = 'local' | 'session';

/**
 * Replay the doctor's original remember-me choice. Never promote a
 * session-only login into localStorage after a network blip.
 */
export function chooseSessionPersistTarget(input: {
  localHasToken: boolean;
  sessionHasToken: boolean;
}): SessionPersistTarget | null {
  if (input.localHasToken) return 'local';
  if (input.sessionHasToken) return 'session';
  return null;
}
