import { apiClient } from './client';

export type ClinicSyncState = 'SYNCED' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'ERROR' | 'CONFLICT';

export interface ClinicSyncStatus {
  kind: 'none' | 'online-hub' | 'offline-peer';
  state: ClinicSyncState;
  paired: boolean;
  pendingOutbound: number;
  conflicts: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  peerClinicName?: string | null;
  onlineClinicId?: string | null;
  devices?: Array<{
    id: string;
    name: string;
    installationId?: string | null;
    createdAt: string;
    lastSeenAt?: string | null;
    revokedAt?: string | null;
  }>;
}

export interface SyncConflictRow {
  conflictId: string;
  entity: string;
  recordUid: string;
  reason: string;
  localJson: string;
  remoteJson: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

export const syncApi = {
  status: () => apiClient.get<ClinicSyncStatus>('/sync/status').then((r) => r.data),
  startPairing: () =>
    apiClient
      .post<{ code: string; expiresAt: string; clinicName: string; clinicId: string }>('/sync/pairing/start')
      .then((r) => r.data),
  connect: (onlineUrl: string, pairingCode: string, deviceName?: string) =>
    apiClient.post('/sync/connect', { onlineUrl, pairingCode, deviceName }).then((r) => r.data),
  disconnect: () => apiClient.post('/sync/disconnect').then((r) => r.data),
  syncNow: () => apiClient.post('/sync/now').then((r) => r.data),
  bootstrap: () => apiClient.post('/sync/bootstrap').then((r) => r.data),
  conflicts: () => apiClient.get<SyncConflictRow[]>('/sync/conflicts').then((r) => r.data),
  resolveConflict: (id: string, resolution: 'keep_local' | 'keep_remote') =>
    apiClient.post(`/sync/conflicts/${id}/resolve`, { resolution }).then((r) => r.data),
  revokeDevice: (id: string) => apiClient.post(`/sync/devices/${id}/revoke`).then((r) => r.data),
};
