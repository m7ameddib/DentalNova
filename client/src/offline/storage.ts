import { CachedGet, OutboxItem } from './core';

const DB_NAME = 'dnt-online-fallback';
const DB_VERSION = 1;

export interface FallbackSnapshot {
  deploymentMode: 'online' | 'offline' | null;
  installationStatus: unknown;
  subscriptionStatus: unknown;
  caches: Record<string, CachedGet>;
  outbox: OutboxItem[];
  idMap: Record<string, number>;
  nextTempId: number;
}

const memory: FallbackSnapshot = {
  deploymentMode: null,
  installationStatus: null,
  subscriptionStatus: null,
  caches: {},
  outbox: [],
  idMap: {},
  nextTempId: -1,
};

let memoryOnly = typeof indexedDB === 'undefined';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (memoryOnly) {
    return Promise.reject(new Error('indexeddb-unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        memoryOnly = true;
        reject(req.error ?? new Error('indexeddb-open-failed'));
      };
    });
  }
  return dbPromise;
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  if (memoryOnly) {
    return ((memory as unknown as Record<string, unknown>)[key] as T) ?? fallback;
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve((req.result as T) ?? fallback);
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryOnly = true;
    return ((memory as unknown as Record<string, unknown>)[key] as T) ?? fallback;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  (memory as unknown as Record<string, unknown>)[key] = value;
  if (memoryOnly) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryOnly = true;
  }
}

export async function getDeploymentMode(): Promise<'online' | 'offline' | null> {
  return kvGet('deploymentMode', memory.deploymentMode);
}

export async function setDeploymentMode(mode: 'online' | 'offline'): Promise<void> {
  memory.deploymentMode = mode;
  await kvSet('deploymentMode', mode);
}

export async function getCachedInstallation(): Promise<unknown> {
  return kvGet('installationStatus', memory.installationStatus);
}

export async function setCachedInstallation(status: unknown): Promise<void> {
  memory.installationStatus = status;
  await kvSet('installationStatus', status);
}

export async function getCachedSubscription(): Promise<unknown> {
  return kvGet('subscriptionStatus', memory.subscriptionStatus);
}

export async function setCachedSubscription(status: unknown): Promise<void> {
  memory.subscriptionStatus = status;
  await kvSet('subscriptionStatus', status);
}

export async function getCaches(): Promise<Record<string, CachedGet>> {
  return { ...(await kvGet('caches', memory.caches)) };
}

export async function setCaches(caches: Record<string, CachedGet>): Promise<void> {
  memory.caches = caches;
  await kvSet('caches', caches);
}

export async function getOutbox(): Promise<OutboxItem[]> {
  return [...(await kvGet('outbox', memory.outbox))];
}

export async function setOutbox(items: OutboxItem[]): Promise<void> {
  memory.outbox = items;
  await kvSet('outbox', items);
}

export async function getIdMap(): Promise<Record<string, number>> {
  return { ...(await kvGet('idMap', memory.idMap)) };
}

export async function setIdMap(idMap: Record<string, number>): Promise<void> {
  memory.idMap = idMap;
  await kvSet('idMap', idMap);
}

export async function getNextTempId(): Promise<number> {
  return kvGet('nextTempId', memory.nextTempId);
}

export async function setNextTempId(id: number): Promise<void> {
  memory.nextTempId = id;
  await kvSet('nextTempId', id);
}

export function resetMemoryStore(): void {
  memory.deploymentMode = null;
  memory.installationStatus = null;
  memory.subscriptionStatus = null;
  memory.caches = {};
  memory.outbox = [];
  memory.idMap = {};
  memory.nextTempId = -1;
}

export function useMemoryStore(): void {
  memoryOnly = true;
}
