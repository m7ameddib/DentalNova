import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from '../platform/platform.service';
import { SyncPairingService } from './sync-pairing.service';
import {
  applyChanges,
  changesSince,
  clinicSnapshot,
  currentCheckpoint,
  listConflicts,
  markAcked,
  maxSeq,
  pendingCount,
  pendingOutbound,
  resolveConflict,
  setCheckpoint,
  unresolvedConflictCount,
} from './sync-apply.util';
import { SyncChangePayload } from './sync.entities';
import { ObjectStorageService } from '../storage/object-storage.service';
import { getTenantClinicId } from '../platform/tenant-context';

export type ClinicSyncState = 'SYNCED' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'ERROR' | 'CONFLICT';

@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);
  private running = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly deployment: DeploymentService,
    private readonly platform: PlatformService,
    private readonly pairing: SyncPairingService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  status() {
    const conn = this.db.connection;
    const pending = pendingCount(conn);
    const conflicts = unresolvedConflictCount(conn);
    const peer = this.pairing.readPeerConfig();
    const lastError = this.readPeerValue('last_error');
    let state: ClinicSyncState = 'OFFLINE';
    if (this.running) {
      state = 'SYNCING';
    } else if (this.deployment.isOnline()) {
      state = conflicts > 0 ? 'CONFLICT' : lastError ? 'ERROR' : pending > 0 ? 'PENDING' : 'SYNCED';
    } else if (peer) {
      state = conflicts > 0 ? 'CONFLICT' : lastError ? 'ERROR' : pending > 0 ? 'PENDING' : 'SYNCED';
    }
    return {
      kind: this.deployment.isOnline() ? 'online-hub' : peer ? 'offline-peer' : 'none',
      state,
      paired: this.deployment.isOnline() || Boolean(peer),
      pendingOutbound: pending,
      conflicts,
      lastSyncedAt: this.readPeerValue('last_synced_at'),
      lastError: this.readPeerValue('last_error'),
      peerClinicName: peer?.clinicName ?? null,
      onlineClinicId: peer?.onlineClinicId ?? null,
      devices: this.deployment.isOnline() && this.platform.isEnabled()
        ? this.platform.listSyncDevices(getTenantClinicId() || '')
        : [],
    };
  }

  pushFromDevice(deviceId: string, clinicId: string, changes: SyncChangePayload[]) {
    if (getTenantClinicId() !== clinicId) {
      throw new Error('CROSS_CLINIC');
    }
    const result = applyChanges(this.db.connection, changes, deviceId);
    return result;
  }

  pullForDevice(deviceId: string, since: number, limit = 200) {
    const device = this.platform.findSyncDevice(deviceId);
    if (!device) return { changes: [], until: since, hasMore: false };
    const { changes, until } = changesSince(this.db.connection, since, deviceId, limit);
    return { changes, until, hasMore: changes.length >= limit };
  }

  snapshotPage(afterEntity?: string, afterId?: number, limit = 80) {
    const { changes, nextAfterEntity, nextAfterId } = clinicSnapshot(
      this.db.connection,
      afterEntity,
      afterId ?? 0,
      limit,
    );
    return {
      changes,
      checkpoint: maxSeq(this.db.connection),
      hasMore: changes.length >= limit,
      nextAfterEntity,
      nextAfterId,
    };
  }

  ackDeviceCheckpoint(deviceId: string, seq: number) {
    this.platform.setDeviceCheckpoint(deviceId, seq);
    return { checkpoint: seq };
  }

  conflicts() {
    return listConflicts(this.db.connection);
  }

  resolve(conflictId: string, resolution: 'keep_local' | 'keep_remote') {
    resolveConflict(this.db.connection, conflictId, resolution);
    return { ok: true };
  }

  async runOfflineCycle(): Promise<{ pushed: number; pulled: number; conflicts: number; error?: string }> {
    if (this.running) return { pushed: 0, pulled: 0, conflicts: unresolvedConflictCount(this.db.connection) };
    const peer = this.pairing.readPeerConfig();
    if (!peer) return { pushed: 0, pulled: 0, conflicts: 0, error: 'not-paired' };
    this.running = true;
    this.writePeerValue('last_error', '');
    try {
      const token = await this.deviceToken(peer);
      let pushed = 0;
      const outbound = pendingOutbound(this.db.connection, 150);
      if (outbound.length > 0) {
        const res = await this.onlineFetch(peer, token, '/api/sync/push', {
          method: 'POST',
          body: JSON.stringify({ changes: outbound }),
        });
        const data = (await res.json()) as {
          accepted?: string[];
          skipped?: string[];
          conflicts?: Array<{ changeId: string }>;
        };
        if (!res.ok) throw new Error(`push-failed-${res.status}`);
        if (!Array.isArray(data.accepted)) throw new Error('push-missing-ack');
        const done = [
          ...data.accepted,
          ...(data.skipped ?? []),
          ...(data.conflicts ?? []).map((c) => c.changeId).filter(Boolean),
        ];
        markAcked(this.db.connection, done);
        pushed = data.accepted.length;
      }

      let pulled = 0;
      let since = currentCheckpoint(this.db.connection);
      for (let i = 0; i < 20; i += 1) {
        const res = await this.onlineFetch(peer, token, `/api/sync/changes?since=${since}&limit=100`, { method: 'GET' });
        const data = (await res.json()) as { changes?: SyncChangePayload[]; until?: number; hasMore?: boolean };
        if (!res.ok) throw new Error(`pull-failed-${res.status}`);
        const batch = data.changes ?? [];
        if (batch.length === 0) break;
        const applied = applyChanges(this.db.connection, batch, 'online-server');
        pulled += applied.accepted.length;
        since = data.until ?? since;
        setCheckpoint(this.db.connection, since);
        if (!data.hasMore) break;
      }

      await this.syncAttachmentBlobs(peer, token);
      this.writePeerValue('last_synced_at', new Date().toISOString());
      return { pushed, pulled, conflicts: unresolvedConflictCount(this.db.connection) };
    } catch (err) {
      const message = (err as Error).message || 'sync-failed';
      this.logger.warn(`Offline sync cycle failed: ${message}`);
      this.writePeerValue('last_error', message);
      return { pushed: 0, pulled: 0, conflicts: unresolvedConflictCount(this.db.connection), error: message };
    } finally {
      this.running = false;
    }
  }

  async bootstrapOffline(): Promise<{ pulled: number }> {
    const peer = this.pairing.readPeerConfig();
    if (!peer) return { pulled: 0 };
    const token = await this.deviceToken(peer);
    let pulled = 0;
    let afterEntity: string | undefined;
    let afterId: number | undefined;
    for (let i = 0; i < 50; i += 1) {
      const qs = new URLSearchParams();
      if (afterEntity) qs.set('afterEntity', afterEntity);
      if (afterId != null) qs.set('afterId', String(afterId));
      qs.set('limit', '80');
      const res = await this.onlineFetch(peer, token, `/api/sync/snapshot?${qs.toString()}`, { method: 'GET' });
      const data = (await res.json()) as {
        changes?: SyncChangePayload[];
        checkpoint?: number;
        hasMore?: boolean;
        nextAfterEntity?: string;
        nextAfterId?: number;
      };
      if (!res.ok) throw new Error(`snapshot-failed-${res.status}`);
      const batch = data.changes ?? [];
      if (batch.length === 0) {
        if (data.checkpoint != null) setCheckpoint(this.db.connection, data.checkpoint);
        break;
      }
      applyChanges(this.db.connection, batch, 'online-server');
      pulled += batch.length;
      afterEntity = data.nextAfterEntity;
      afterId = data.nextAfterId;
      if (data.checkpoint != null) setCheckpoint(this.db.connection, data.checkpoint);
      if (!data.hasMore) break;
    }
    await this.syncAttachmentBlobs(peer, token);
    this.writePeerValue('last_synced_at', new Date().toISOString());
    return { pulled };
  }

  async putFileFromDevice(relativePath: string, bytes: Buffer, mimeType?: string) {
    if (!relativePath?.trim()) throw new Error('Invalid storage path');
    await this.objectStorage.putObject(relativePath, bytes, mimeType);
    return { stored: relativePath, bytes: bytes.length };
  }

  async getFileForDevice(relativePath: string) {
    return this.objectStorage.getObject(relativePath);
  }

  private async syncAttachmentBlobs(
    peer: { onlineBaseUrl: string },
    token: string,
  ): Promise<void> {
    if (!this.tableExists('patient_attachments')) return;
    const rows = this.db.connection
      .prepare(`SELECT stored_path AS storedPath, mime_type AS mimeType FROM patient_attachments`)
      .all() as Array<{ storedPath: string; mimeType: string | null }>;
    for (const row of rows) {
      if (!row.storedPath) continue;
      const already = this.tableExists('sync_file_objects')
        ? (this.db.connection
            .prepare(`SELECT uploaded_at AS uploadedAt FROM sync_file_objects WHERE record_uid = ?`)
            .get(row.storedPath) as { uploadedAt?: string } | undefined)
        : undefined;
      const local = await this.objectStorage.getObject(row.storedPath);
      if (local && local.length > 0) {
        if (already?.uploadedAt) continue;
        const encoded = local.toString('base64');
        const res = await this.onlineFetch(peer, token, '/api/sync/files', {
          method: 'POST',
          body: JSON.stringify({
            relativePath: row.storedPath,
            contentBase64: encoded,
            mimeType: row.mimeType,
          }),
        });
        if (res.ok) this.markFileUploaded(row.storedPath, local.length, row.mimeType);
        continue;
      }
      const res = await this.onlineFetch(
        peer,
        token,
        `/api/sync/files?path=${encodeURIComponent(row.storedPath)}`,
        { method: 'GET' },
      );
      const data = (await res.json().catch(() => ({}))) as { found?: boolean; contentBase64?: string };
      if (res.ok && data.found && data.contentBase64) {
        await this.objectStorage.putObject(row.storedPath, Buffer.from(data.contentBase64, 'base64'), row.mimeType);
        this.markFileUploaded(row.storedPath, Buffer.from(data.contentBase64, 'base64').length, row.mimeType);
      }
    }
  }

  private markFileUploaded(relativePath: string, byteSize: number, mimeType: string | null): void {
    if (!this.tableExists('sync_file_objects')) return;
    this.db.connection
      .prepare(
        `INSERT INTO sync_file_objects (record_uid, relative_path, mime_type, byte_size, uploaded_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(record_uid) DO UPDATE SET
           relative_path = excluded.relative_path,
           mime_type = excluded.mime_type,
           byte_size = excluded.byte_size,
           uploaded_at = excluded.uploaded_at`,
      )
      .run(relativePath, relativePath, mimeType, byteSize);
  }

  private tableExists(name: string): boolean {
    const row = this.db.connection
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(name);
    return Boolean(row);
  }

  private async deviceToken(peer: { onlineBaseUrl: string; deviceId: string; deviceSecret: string }): Promise<string> {
    const res = await fetch(`${peer.onlineBaseUrl}/api/sync/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: peer.deviceId, deviceSecret: peer.deviceSecret }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { accessToken?: string };
    if (!res.ok || !data.accessToken) throw new Error('device-auth-failed');
    return data.accessToken;
  }

  private async onlineFetch(peer: { onlineBaseUrl: string }, token: string, path: string, init: RequestInit) {
    return fetch(`${peer.onlineBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(45_000),
    });
  }

  private readPeerValue(key: string): string | null {
    const row = this.db.connection.prepare(`SELECT value FROM sync_peer_state WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  private writePeerValue(key: string, value: string): void {
    this.db.connection
      .prepare(`INSERT INTO sync_peer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(key, value);
  }
}
