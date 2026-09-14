/** Reconstruct the signed license string stored as JSON payload + signature parts. */
export function reconstructLicenseText(payloadJson: string, signature: string): string {
  const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64url');
  return `${payloadB64}.${signature}`;
}

export function isLicenseExpiryDue(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return !Number.isNaN(expiry) && expiry < now;
}

export function isLegacyDevLicensePayload(payloadJson: string | null | undefined): boolean {
  if (!payloadJson) return false;
  try {
    const parsed = JSON.parse(payloadJson) as { legacyDev?: boolean };
    return parsed?.legacyDev === true;
  } catch {
    return false;
  }
}

/**
 * Unsigned / legacyDev licenses are only tolerated outside production so
 * `npm run seed` still works. Production Offline must have a verified signature.
 */
export function unsignedLicensePermitted(isProduction: boolean): boolean {
  return !isProduction;
}
