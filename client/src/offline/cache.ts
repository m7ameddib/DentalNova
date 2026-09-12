import { applyMutationToCaches, cacheKey, CachedGet, remapIds } from './core';
import { getCaches, getIdMap, setCaches } from './storage';

export function requestCacheKey(method: string, url: string): string {
  return cacheKey(method, url);
}

export async function saveGetCache(method: string, url: string, status: number, data: unknown): Promise<void> {
  const caches = await getCaches();
  const key = requestCacheKey(method, url);
  caches[key] = { key, status, data, cachedAt: new Date().toISOString() };
  await setCaches(caches);
}

export async function readGetCache(method: string, url: string): Promise<CachedGet | null> {
  const caches = await getCaches();
  return caches[requestCacheKey(method, url)] ?? null;
}

export async function applyLocalMutation(mutation: {
  method: string;
  url: string;
  body: unknown;
  result?: Record<string, unknown>;
  tempId?: number;
}): Promise<void> {
  const caches = await getCaches();
  await setCaches(applyMutationToCaches(caches, mutation));
}

export async function remapCachedIds(): Promise<void> {
  const idMap = await getIdMap();
  if (Object.keys(idMap).length === 0) return;
  const caches = await getCaches();
  const remapped: Record<string, CachedGet> = {};
  for (const [key, entry] of Object.entries(caches)) {
    const nextKey = remapIds(key, idMap);
    remapped[nextKey] = {
      ...entry,
      key: nextKey,
      data: remapIds(entry.data, idMap),
    };
  }
  await setCaches(remapped);
}
