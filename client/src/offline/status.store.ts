import { create } from 'zustand';

export type ConnectionState = 'online' | 'offline' | 'syncing';

interface OfflineStatusState {
  enabled: boolean;
  connection: ConnectionState;
  pending: number;
  conflicts: number;
  lastError: string | null;
  needsReauth: boolean;
  setEnabled: (enabled: boolean) => void;
  setConnection: (connection: ConnectionState) => void;
  setQueue: (pending: number, conflicts: number) => void;
  setLastError: (error: string | null) => void;
  setNeedsReauth: (needsReauth: boolean) => void;
}

export const useOfflineStatusStore = create<OfflineStatusState>((set) => ({
  enabled: false,
  connection: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  pending: 0,
  conflicts: 0,
  lastError: null,
  needsReauth: false,
  setEnabled: (enabled) => set({ enabled }),
  setConnection: (connection) => set({ connection }),
  setQueue: (pending, conflicts) => set({ pending, conflicts }),
  setLastError: (lastError) => set({ lastError }),
  setNeedsReauth: (needsReauth) => set({ needsReauth }),
}));

export function isFallbackEnabled(): boolean {
  return useOfflineStatusStore.getState().enabled;
}

export function isFallbackOffline(): boolean {
  const state = useOfflineStatusStore.getState();
  return state.enabled && state.connection !== 'online';
}
