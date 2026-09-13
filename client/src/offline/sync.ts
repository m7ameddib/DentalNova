import axios, { AxiosInstance } from 'axios';
import { classifyReplayError, MAX_SYNC_ATTEMPTS, remapIds, requeueStuckItems } from './core';
import { applyLocalMutation, remapCachedIds } from './cache';
import { getIdMap, getOutbox, setOutbox } from './storage';
import { listOutbox, rememberIdMapping, removeOutboxItem, updateOutboxItem } from './outbox';
import { useOfflineStatusStore } from './status.store';
import { useAuthStore } from '@/store/auth.store';
import { queryClient } from '@/queryClient';

let flushing = false;

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
  if (flushing) return;
  if (!useOfflineStatusStore.getState().enabled) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const token = useAuthStore.getState().token;
  if (!token) return;

  flushing = true;
  useOfflineStatusStore.getState().setConnection('syncing');
  useOfflineStatusStore.getState().setLastError(null);

  try {
    const released = requeueStuckItems(await getOutbox());
    await setOutbox(released);
    const items = released
      .filter((item) => item.status === 'pending' || item.status === 'syncing')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (items.length === 0) {
      return;
    }

    let synced = 0;
    for (const item of items) {
      const idMap = await getIdMap();
      const url = remapIds(item.url, idMap);
      const data = remapIds(item.data, idMap);
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
            continue;
          }
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
          status: kind === 'conflict' ? 'conflict' : 'failed',
          lastError: error.message,
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
    const pending = useOfflineStatusStore.getState().pending;
    const online = typeof navigator === 'undefined' || navigator.onLine;
    useOfflineStatusStore.getState().setConnection(
      !online ? 'offline' : pending > 0 && useOfflineStatusStore.getState().needsReauth ? 'offline' : 'online',
    );
  }
}

export async function retryFailedOutbox(): Promise<void> {
  const items = await getOutbox();
  await setOutbox(
    items.map((item) =>
      item.status === 'failed' || item.status === 'conflict'
        ? { ...item, status: 'pending', attempts: 0, lastError: item.lastError }
        : item,
    ),
  );
  await listOutbox();
}

