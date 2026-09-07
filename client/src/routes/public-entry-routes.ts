/** Routes that must render immediately without gate loading spinners or subscription blocking. */
const PUBLIC_ENTRY_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/setup',
  '/activate',
  '/subscription-status',
  '/server-config',
]);

export function isPublicEntryPath(pathname: string): boolean {
  if (PUBLIC_ENTRY_PATHS.has(pathname)) return true;
  return pathname.startsWith('/dibnova-admin');
}
