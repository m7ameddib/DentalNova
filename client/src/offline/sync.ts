import axios, { AxiosInstance } from 'axios';
import {
  classifyReplayError,
  collectTempIds,
  MAX_SYNC_ATTEMPTS,
  remapIds,
  requeueStuckItems,
  stillHasUnmappedTempId,
} from './core';
import { applyLocalMutation, remapCachedIds } from './cache';
import { getIdMap, getOutbox, setOutbox } from './storage';
import { listOutbox, pruneSettledOutbox, rememberIdMapping, removeOutboxItem, updateOutboxItem } from './outbox';
import { useOfflineStatusStore } from './status.store';
import { useAuthStore } from '@/store/auth.store';
import { queryClient } from '@/queryClient';

let flushing = false;
let flushingSince = 0;
const FLUSH_LOCK_MS = 60_000;
const REPLAY_TIMEOUT_MS = 15_000;

function beginFlush(): boolean {
  const now = Date.now();
  if (flushing && now - flushingSince < FLUSH_LOCK_MS) return false;
  flushing = true;
  flushingSince = now;
  return true;
}

function requestUrl(item: { url: string }): string {
  return item.url;
}

async function resolveDuplicatePatient(
  api: AxiosInstance,
  phone: unknown,
): Promise<number | null> {
  if (typeof phone !== 'string' || !phone.trim()) return null;
  try {
    const res = await api.get('/patients/check-phone', {
      params: { phone },
      skipOfflineFallback: true,
    });
    const first = Array.isArray(res.data) ? res.data[0] : null;
    return first && typeof first.id === 'number' ? first.id : null;
  } catch {
    return null;
  }
}

export async function flushOutbox(api: AxiosInstance): Promise<void> {
  if (!useOfflineStatusStore.getState().enabled) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!beginFlush()) return;

  const token = useAuthStore.getState().token;
  if (!token) {
    flushing = false;
    return;
  }

  useOfflineStatusStore.getState().setLastError(null);
  useOfflineStatusStore.getState().setNeedsReauth(false);

  try {
    const released = requeueStuckItems(await getOutbox());
    await setOutbox(released);
    const items = released
      .filter((item) => item.status === 'pending' || item.status === 'syncing')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (items.length === 0) {
      return;
    }

    useOfflineStatusStore.getState().setConnection('syncing');

    let synced = 0;
    for (const item of items) {
      const idMap = await getIdMap();
      const url = remapIds(item.url, idMap);
      const data = remapIds(item.data, idMap);

        if (stillHasUnmappedTempId(url) || stillHasUnmappedTempId(data)) {
        const needed = collectTempIds(data, collectTempIds(url));
        const queue = await getOutbox();
        const parentQueued = queue.some(
          (other) => other.id !== item.id && other.tempId != null && needed.has(other.tempId),
        );
        if (parentQueued) {
          await updateOutboxItem(item.id, { status: 'pending', url, data });
          continue;
        }
        await updateOutboxItem(item.id, {
          status: 'failed',
          lastError: 'unmapped-temp-id',
          url,
          data,
        });
        useOfflineStatusStore.getState().setLastError('unmapped-temp-id');
        continue;
      }

      const attempts = (item.attempts ?? 0) + 1;
      await updateOutboxItem(item.id, {
        status: 'syncing',
        url,
        data,
        attempts,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const res = await api.request({
          method: item.method,
          url,
          data,
          timeout: REPLAY_TIMEOUT_MS,
          headers: {
            ...item.headers,
            'X-Idempotency-Key': item.id,
          },
          skipOfflineFallback: true,
        });

        const realId = (res.data as { id?: number } | undefined)?.id;
        if (item.tempId != null && typeof realId === 'number') {
          await rememberIdMapping(item.tempId, realId);
          await remapCachedIds();
          const remaining = remapIds(await getOutbox(), { [String(item.tempId)]: realId });
          await setOutbox(remaining);
        }

        await removeOutboxItem(item.id);
        synced += 1;
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          await updateOutboxItem(item.id, {
            status: attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending',
            lastError: 'sync-failed',
            attempts,
            lastAttemptAt: new Date().toISOString(),
          });
          useOfflineStatusStore.getState().setLastError('sync-failed');
          continue;
        }

        const status = error.response?.status;
        const kind = classifyReplayError(status);

        if (kind === 'auth') {
          useOfflineStatusStore.getState().setNeedsReauth(true);
          await updateOutboxItem(item.id, { status: 'pending', lastError: 'auth', attempts, lastAttemptAt: new Date().toISOString() });
          break;
        }

        if (kind === 'conflict' && item.method === 'POST' && requestUrl(item).includes('/patients')) {
          const existingId = await resolveDuplicatePatient(api, (data as { phone?: string })?.phone);
          if (existingId != null && item.tempId != null) {
            await rememberIdMapping(item.tempId, existingId);
            await remapCachedIds();
            await applyLocalMutation({
              method: 'PATCH',
              url: `/patients/${item.tempId}`,
              body: { id: existingId },
              result: { id: existingId },
            });
            const remaining = remapIds(await getOutbox(), { [String(item.tempId)]: existingId });
            await setOutbox(remaining);
            await removeOutboxItem(item.id);
            synced += 1;
            continue;
          }
        }

        if (kind === 'conflict') {
          await updateOutboxItem(item.id, {
            status: 'conflict',
            lastError: status ? `http-${status}` : error.message,
            attempts,
            lastAttemptAt: new Date().toISOString(),
          });
          useOfflineStatusStore.getState().setLastError(status ? `http-${status}` : error.message);
          continue;
        }

        if (status === 400 || status === 403 || status === 422) {
          await updateOutboxItem(item.id, {
            status: 'failed',
            lastError: status ? `http-${status}` : error.message,
            attempts,
            lastAttemptAt: new Date().toISOString(),
          });
          useOfflineStatusStore.getState().setLastError(status ? `http-${status}` : error.message);
          continue;
        }

        if (kind === 'retry') {
          await updateOutboxItem(item.id, {
            status: attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending',
            lastError: error.message,
            attempts,
            lastAttemptAt: new Date().toISOString(),
          });
          useOfflineStatusStore.getState().setLastError(error.message);
          continue;
        }

        await updateOutboxItem(item.id, {
          status: 'failed',
          lastError: status ? `http-${status}` : error.message,
          attempts,
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    await listOutbox();
    if (synced > 0) {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0] ?? '');
          return key !== 'installation-status' && key !== 'subscription-status';
        },
      });
    }
  } finally {
    flushing = false;
    await listOutbox();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      useOfflineStatusStore.getState().setConnection('offline');
    }
  }
}

export async function retryFailedOutbox(): Promise<void> {
  const items = await pruneSettledOutbox();
  await setOutbox(
    items.map((item) =>
      item.status === 'failed'
        ? { ...item, status: 'pending', attempts: 0, lastError: item.lastError }
        : item,
    ),
  );
  await listOutbox();
}
