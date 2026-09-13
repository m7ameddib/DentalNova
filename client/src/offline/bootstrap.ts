import { apiClient } from '@/api/client';
import { localTodayIso } from '@/utils/date';
import { hydrateOnlineScope } from './scope';
import { listOutbox } from './outbox';
import { syncWhenOnline } from './intercept';
import { useOfflineStatusStore } from './status.store';
import { probeApiHealth } from './health';

let started = false;

async function prefetchLocalClinic(): Promise<void> {
  if (!useOfflineStatusStore.getState().enabled) return;
  const today = localTodayIso();
  await Promise.allSettled([
    apiClient.get('/patients'),
    apiClient.get('/appointments', { params: { date: today } }),
    apiClient.get('/treatment-types'),
    apiClient.get('/payment-methods'),
    apiClient.get('/settings/clinic'),
    apiClient.get('/subscription/status'),
    apiClient.get('/installation/status'),
  ]);
}

let lifecycleBound = false;

async function connectOrStayOffline(): Promise<void> {
  if (!useOfflineStatusStore.getState().enabled) return;
  const mark = useOfflineStatusStore.getState();
  const online = typeof navigator === 'undefined' || navigator.onLine;
  mark.setConnection(online ? 'online' : 'offline');
  if (!online) return;
  const up = await probeApiHealth(apiClient);
  if (up) {
    await syncWhenOnline(apiClient);
    await prefetchLocalClinic();
    return;
  }
  mark.setConnection('offline');
}

function bindFallbackLifecycle(): void {
  if (lifecycleBound) return;
  lifecycleBound = true;
  window.addEventListener('online', () => {
    void (async () => {
      if (!useOfflineStatusStore.getState().enabled) return;
      const up = await probeApiHealth(apiClient);
      if (up) {
        await syncWhenOnline(apiClient);
        await prefetchLocalClinic();
      } else {
        useOfflineStatusStore.getState().setConnection('offline');
      }
    })();
  });
  window.addEventListener('offline', () => {
    useOfflineStatusStore.getState().setConnection('offline');
  });
  window.setInterval(() => {
    if (!useOfflineStatusStore.getState().enabled) return;
    void (async () => {
      await syncWhenOnline(apiClient);
      if (useOfflineStatusStore.getState().connection === 'online') {
        await prefetchLocalClinic();
      }
    })();
  }, 30_000);
}

export async function startOfflineFallback(): Promise<void> {
  if (started) return;
  started = true;
  const enabled = await hydrateOnlineScope();
  await listOutbox();
  bindFallbackLifecycle();
  if (enabled) {
    await connectOrStayOffline();
    return;
  }
  const unsub = useOfflineStatusStore.subscribe((state) => {
    if (!state.enabled) return;
    unsub();
    void connectOrStayOffline();
  });
}
