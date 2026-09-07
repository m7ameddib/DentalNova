const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

/** Normalize to digits-only for lookup and uniqueness checks. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.length >= MIN_PHONE_DIGITS && normalized.length <= MAX_PHONE_DIGITS;
}

/** Mask phone for logs/responses, e.g. ***1234 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}
