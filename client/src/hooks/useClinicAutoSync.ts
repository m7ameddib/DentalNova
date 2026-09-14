import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { syncApi } from '@/api/sync.api';

/**
 * When an Offline clinic is paired, run the existing sync engine as soon as
 * the computer comes back online (or the window is focused while online).
 * The server also retries every 30s; this avoids waiting for the next tick.
 */
export function useClinicAutoSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    let busy = false;

    async function syncIfPaired() {
      if (busy) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      busy = true;
      try {
        const status = await syncApi.status();
        if (status.kind === 'offline-peer' && status.paired) {
          await syncApi.syncNow();
          await queryClient.invalidateQueries({ queryKey: ['clinic-sync-status'] });
          await queryClient.invalidateQueries({ queryKey: ['clinic-sync-conflicts'] });
        }
      } catch {
        /* next reconnect / scheduler tick retries */
      } finally {
        busy = false;
      }
    }

    function onOnline() {
      void syncIfPaired();
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void syncIfPaired();
    }

    const t = window.setTimeout(() => void syncIfPaired(), 2000);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, queryClient]);
}
