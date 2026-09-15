export type AuthenticodeStatus = 'Valid' | 'NotSigned' | 'HashMismatch' | 'NotTrusted' | 'UnknownError' | string;

export interface AuthenticodeInspection {
  status: AuthenticodeStatus;
  signer: string | null;
}

export function unsignedInstallerMessage(installerFileName: string): string {
  return `Installer ${installerFileName} is not Authenticode-signed. Refusing to launch an unsigned update.`;
}

export function untrustedInstallerMessage(installerFileName: string, signer: string | null): string {
  const who = signer ? ` (signer: ${signer})` : '';
  return `Installer ${installerFileName} failed Authenticode verification${who}. Refusing to launch.`;
}

export function publisherMismatchMessage(installerFileName: string, expected: string, actual: string | null): string {
  return `Installer ${installerFileName} is signed by ${actual || 'an unknown publisher'}, expected ${expected}.`;
}

/** Parse Get-AuthenticodeSignature JSON (or a Status string). */
export function inspectAuthenticodePayload(payload: unknown): AuthenticodeInspection {
  if (typeof payload === 'string') {
    const status = payload.trim() || 'UnknownError';
    return { status, signer: null };
  }
  if (!payload || typeof payload !== 'object') {
    return { status: 'UnknownError', signer: null };
  }
  const rec = payload as Record<string, unknown>;
  const status = String(rec.Status || rec.status || 'UnknownError');
  const signerInfo = rec.SignerCertificate as Record<string, unknown> | undefined;
  const signer =
    (typeof rec.signer === 'string' && rec.signer) ||
    (typeof signerInfo?.Subject === 'string' && signerInfo.Subject) ||
    (typeof rec.Subject === 'string' && rec.Subject) ||
    null;
  return { status, signer };
}

export function assertAuthenticodeTrusted(
  inspection: AuthenticodeInspection,
  installerFileName: string,
  expectedPublisher?: string | null,
): void {
  if (inspection.status !== 'Valid') {
    if (inspection.status === 'NotSigned') {
      throw new Error(unsignedInstallerMessage(installerFileName));
    }
    throw new Error(untrustedInstallerMessage(installerFileName, inspection.signer));
  }
  const expected = expectedPublisher?.trim();
  if (expected) {
    const actual = inspection.signer || '';
    if (!actual.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(publisherMismatchMessage(installerFileName, expected, inspection.signer));
    }
  }
}
