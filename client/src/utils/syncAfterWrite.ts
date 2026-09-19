import { syncApi } from '@/api/sync.api';
import { syncWhenOnline } from '@/offline/intercept';
import { apiClient } from '@/api/client';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

/** Trigger clinic sync after a local write (debounced). Keeps the 30s scheduler unchanged. */
export function scheduleClinicSyncAfterWrite(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runClinicSyncNow();
  }, 400);
}

export async function runClinicSyncNow(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const status = await syncApi.status();
    if (status.kind === 'offline-peer' && status.paired) {
      await syncWhenOnline(apiClient);
      await syncApi.syncNow();
    }
  } catch {
    /* scheduler / focus handlers retry */
  } finally {
    inFlight = false;
  }
}
