export interface NamedReleaseAsset {
  name: string;
}

/** Exact installer filename for a GitHub release tag (`v1.2.3` or `1.2.3`). */
export function expectedInstallerFileName(tagName: string): string {
  const version = String(tagName || '')
    .replace(/^v/i, '')
    .trim();
  return `DNT-Dental-Main-Clinic-Setup-v${version}.exe`;
}

/**
 * Only the installer whose name matches this release tag is eligible.
 * A leftover/mismatched `DNT-Dental-Main-Clinic-Setup-v*.exe` on the same
 * release must not be treated as an update for this version.
 */
export function findInstallerAsset<T extends NamedReleaseAsset>(assets: T[] | null | undefined, tagName: string): T | null {
  if (!Array.isArray(assets) || !tagName) return null;
  const expected = expectedInstallerFileName(tagName);
  return assets.find((asset) => asset.name === expected) ?? null;
}
