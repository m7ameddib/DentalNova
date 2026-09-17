import { apiClient } from './client';

export type ClinicSyncState = 'SYNCED' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'ERROR' | 'CONFLICT';

export interface ClinicSyncCensus {
  patients: number;
  payments: number;
  treatments: number;
  appointments: number;
  total: number;
}

export interface ClinicSyncDevice {
  id: string;
  name: string;
  installationId?: string | null;
  createdAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  pullCheckpoint?: number;
}

export interface ClinicSyncStatus {
  kind: 'none' | 'online-hub' | 'offline-peer';
  state: ClinicSyncState;
  paired: boolean;
  bootstrapped?: boolean;
  needsBootstrap?: boolean;
  pendingOutbound: number;
  conflicts: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  peerClinicName?: string | null;
  onlineClinicId?: string | null;
  localClinicName?: string | null;
  pairingBlocked?: boolean;
  census?: ClinicSyncCensus | null;
  devices?: ClinicSyncDevice[];
}

export interface PairingStartResult {
  code: string;
  expiresAt: string;
  clinicName: string;
  clinicId: string;
  onlineUrl: string;
  ttlMinutes: number;
}

export interface PairingPreviewResult {
  clinicId: string;
  clinicName: string;
  expiresAt: string;
  onlineUrl: string;
}

export interface PublicPeerInfo {
  paired: true;
  deviceId: string;
  onlineBaseUrl: string;
  clinicId: string;
  clinicName: string;
  pairedAt: string;
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

export interface SyncNowResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  error?: string;
}

export const SYNC_CONNECT_TIMEOUT_MS = 60_000;
export const SYNC_BOOTSTRAP_TIMEOUT_MS = 900_000;
export const SYNC_NOW_TIMEOUT_MS = 600_000;

export const syncApi = {
  status: () => apiClient.get<ClinicSyncStatus>('/sync/status').then((r) => r.data),
  startPairing: () => apiClient.post<PairingStartResult>('/sync/pairing/start').then((r) => r.data),
  previewConnect: (onlineUrl: string, pairingCode: string) =>
    apiClient
      .post<PairingPreviewResult>(
        '/sync/connect/preview',
        { onlineUrl, pairingCode },
        { timeout: SYNC_CONNECT_TIMEOUT_MS },
      )
      .then((r) => r.data),
  connect: (onlineUrl: string, pairingCode: string, deviceName?: string) =>
    apiClient
      .post<PublicPeerInfo>(
        '/sync/connect',
        { onlineUrl, pairingCode, deviceName },
        { timeout: SYNC_CONNECT_TIMEOUT_MS },
      )
      .then((r) => r.data),
  disconnect: () => apiClient.post('/sync/disconnect', {}, { timeout: SYNC_CONNECT_TIMEOUT_MS }).then((r) => r.data),
  syncNow: () =>
    apiClient.post<SyncNowResult>('/sync/now', {}, { timeout: SYNC_NOW_TIMEOUT_MS }).then((r) => r.data),
  bootstrap: () => apiClient.post('/sync/bootstrap', {}, { timeout: SYNC_BOOTSTRAP_TIMEOUT_MS }).then((r) => r.data),
  conflicts: () => apiClient.get<SyncConflictRow[]>('/sync/conflicts').then((r) => r.data),
  resolveConflict: (id: string, resolution: 'keep_local' | 'keep_remote') =>
    apiClient.post(`/sync/conflicts/${id}/resolve`, { resolution }).then((r) => r.data),
  revokeDevice: (id: string) => apiClient.post(`/sync/devices/${id}/revoke`).then((r) => r.data),
};
