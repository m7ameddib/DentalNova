import { AxiosRequestConfig } from 'axios';
import { normalizePath } from './core';

export function axiosRequestUrl(config: AxiosRequestConfig): string {
  const raw = `${config.baseURL ?? ''}${config.url ?? ''}`;
  const path = normalizePath(raw.split('?')[0] ?? raw);
  const params = config.params as Record<string, unknown> | undefined;
  if (!params || Object.keys(params).length === 0) {
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
    return `${path}${query}`;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
