const STORAGE_KEY = 'dnt-api-base';

/** Relative `/api` on main server; full URL on clinic client laptops. */
export function getApiBaseUrl(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored.replace(/\/+$/, '');
  return '/api';
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/+$/, ''));
}

export function clearApiBaseUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isClientMode(): boolean {
  const base = getApiBaseUrl();
  return base.startsWith('http://') || base.startsWith('https://');
}

export function serverRootFromApiBase(): string {
  const base = getApiBaseUrl();
  if (base.endsWith('/api')) return base.slice(0, -4);
  return base;
}
