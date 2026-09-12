import { conflictCount, nextTempId, OutboxItem, pendingCount } from './core';
import { getIdMap, getNextTempId, getOutbox, setIdMap, setNextTempId, setOutbox } from './storage';
import { useOfflineStatusStore } from './status.store';

function refreshQueueCounts(items: OutboxItem[]): void {
  useOfflineStatusStore.getState().setQueue(pendingCount(items), conflictCount(items));
}

export async function allocateTempId(): Promise<number> {
  const current = await getNextTempId();
  const id = nextTempId(current);
  await setNextTempId(id);
  return id;
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  const items = await getOutbox();
  items.push(item);
  await setOutbox(items);
  refreshQueueCounts(items);
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const items = await getOutbox();
  refreshQueueCounts(items);
  return items;
}

export async function updateOutboxItem(id: string, patch: Partial<OutboxItem>): Promise<void> {
  const items = (await getOutbox()).map((item) => (item.id === id ? { ...item, ...patch } : item));
  await setOutbox(items);
  refreshQueueCounts(items);
}

export async function removeOutboxItem(id: string): Promise<void> {
  const items = (await getOutbox()).filter((item) => item.id !== id);
  await setOutbox(items);
  refreshQueueCounts(items);
}

export async function rememberIdMapping(tempId: number, realId: number): Promise<void> {
  const idMap = await getIdMap();
  idMap[String(tempId)] = realId;
  await setIdMap(idMap);
}

export function newOutboxId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
