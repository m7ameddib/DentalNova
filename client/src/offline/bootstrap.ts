import { apiClient } from '@/api/client';
import { hydrateOnlineScope } from './scope';
import { listOutbox } from './outbox';
import { syncWhenOnline } from './intercept';
import { useOfflineStatusStore } from './status.store';

let started = false;

async function prefetchLocalClinic(): Promise<void> {
  if (!useOfflineStatusStore.getState().enabled) return;
  try {
    await apiClient.get('/patients');
  } catch {
    /* keep existing local cache */
  }
}

async function probeHealth(): Promise<boolean> {
  try {
    const res = await apiClient.get('/health', { timeout: 4000, skipOfflineFallback: true });
    return res.data?.ok === true;
  } catch {
    return false;
  }
}

export async function startOfflineFallback(): Promise<void> {
  if (started) return;
  started = true;
  const enabled = await hydrateOnlineScope();
  await listOutbox();
  if (!enabled) return;

  const mark = useOfflineStatusStore.getState();
  const online = typeof navigator === 'undefined' || navigator.onLine;
  mark.setConnection(online ? 'online' : 'offline');

  if (online) {
    const up = await probeHealth();
    if (up) {
      await syncWhenOnline(apiClient);
      await prefetchLocalClinic();
    } else {
      mark.setConnection('offline');
    }
  }

  window.addEventListener('online', () => {
    useOfflineStatusStore.getState().setConnection('online');
    void (async () => {
      const up = await probeHealth();
      if (up) {
        await syncWhenOnline(apiClient);
        await prefetchLocalClinic();
      } else useOfflineStatusStore.getState().setConnection('offline');
    })();
  });
  window.addEventListener('offline', () => {
    useOfflineStatusStore.getState().setConnection('offline');
  });

  window.setInterval(() => {
    if (!useOfflineStatusStore.getState().enabled) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    void (async () => {
      await syncWhenOnline(apiClient);
      await prefetchLocalClinic();
    })();
  }, 30_000);
}
