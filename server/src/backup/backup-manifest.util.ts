import { createHash } from 'crypto';

export const BACKUP_MANIFEST_VERSION = 3;

export interface BackupManifestIdentity {
  version: number;
  createdAt: string;
  appVersion: string;
  includes: string[];
  clinicId?: string | null;
  installationId?: string | null;
  dbSha256?: string | null;
}

export function sha256Buffer(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** True when a v3+ backup belongs to a different Online clinic than the one restoring it. */
export function backupClinicMismatch(
  manifestClinicId: string | null | undefined,
  currentClinicId: string | null | undefined,
): boolean {
  if (!manifestClinicId || !currentClinicId) return false;
  return manifestClinicId !== currentClinicId;
}

export function backupInstallationMismatch(
  manifestInstallationId: string | null | undefined,
  currentInstallationId: string | null | undefined,
): boolean {
  if (!manifestInstallationId || !currentInstallationId) return false;
  return manifestInstallationId !== currentInstallationId;
}

export function backupHashMismatch(expected: string | null | undefined, actual: string): boolean {
  if (!expected) return false;
  return expected.toLowerCase() !== actual.toLowerCase();
}
