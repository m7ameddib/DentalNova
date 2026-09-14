export function missingInstallerChecksumMessage(installerFileName: string): string {
  return `Installer checksum ${installerFileName}.sha256 is required. Refusing to apply an unsigned update.`;
}

export function installerChecksumMismatchMessage(installerFileName: string): string {
  return `Installer ${installerFileName} failed SHA-256 verification. Refusing to launch.`;
}

/** Updates must not install a GitHub asset that has no published SHA-256 sidecar. */
export function assertInstallerChecksumPresent(hasChecksumAsset: boolean, installerFileName: string): void {
  if (!hasChecksumAsset) {
    throw new Error(missingInstallerChecksumMessage(installerFileName));
  }
}

export function parseSha256Text(raw: string): string {
  return raw.trim().toLowerCase().split(/\s+/)[0] ?? '';
}

export function assertSha256Match(actualHex: string, expectedHex: string, installerFileName: string): void {
  if (actualHex.toLowerCase() !== expectedHex.toLowerCase()) {
    throw new Error(installerChecksumMismatchMessage(installerFileName));
  }
}
