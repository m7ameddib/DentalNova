import { createHash } from 'crypto';

/** Fingerprint of the current password hash, bound into a reset JWT. */
export function passwordResetTag(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 24);
}

/** After a successful reset the hash changes, so the same JWT cannot be reused. */
export function passwordResetTagMatches(passwordHash: string, tag: string | undefined | null): boolean {
  if (!tag) return false;
  return passwordResetTag(passwordHash) === tag;
}
