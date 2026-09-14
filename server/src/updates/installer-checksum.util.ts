export function missingInstallerChecksumMessage(installerFileName: string): string {
  return `Installer checksum ${installerFileName}.sha256 is required. Refusing to apply an unsigned update.`;
}

/** Updates must not install a GitHub asset that has no published SHA-256 sidecar. */
export function assertInstallerChecksumPresent(hasChecksumAsset: boolean, installerFileName: string): void {
  if (!hasChecksumAsset) {
    throw new Error(missingInstallerChecksumMessage(installerFileName));
  }
}
