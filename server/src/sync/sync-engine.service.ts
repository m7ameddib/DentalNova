import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  recordInboundConflicts,
  resolveConflict,
  setCheckpoint,
  unresolvedConflictCount,
} from './sync-apply.util';
import { SyncChangePayload } from './sync.entities';
import { ObjectStorageService } from '../storage/object-storage.service';
import { getTenantClinicId } from '../platform/tenant-context';
import { clinicOperationalCensus, POPULATED_OFFLINE_CODE, populatedOfflineMessage } from './clinic-census.util';
import { BOOTSTRAP_PAGE_SIZE, MAX_BOOTSTRAP_PAGES, bootstrapSnapshotFinished } from './bootstrap.util';

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
    const conflicts = unresolvedConflictCount(conn);
    const peer = this.pairing.readPeerConfig();
    const lastError = this.readPeerValue('last_error');
    const pending = this.deployment.isOnline() ? this.onlineDevicesBehind() : pendingCount(conn);
    const census = this.deployment.isOffline() ? clinicOperationalCensus(conn) : null;
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
      paired: this.deployment.isOnline() ? this.onlineDeviceCount() > 0 : Boolean(peer),
      pendingOutbound: pending,
      conflicts,
      lastSyncedAt: this.readPeerValue('last_synced_at'),
      lastError: this.readPeerValue('last_error'),
      peerClinicName: peer?.clinicName ?? null,
      onlineClinicId: peer?.onlineClinicId ?? null,
      localClinicName: this.pairing.localClinicName(),
      pairingBlocked: Boolean(this.deployment.isOffline() && !peer && census?.populated),
      census: census
        ? {
            patients: census.counts.patients ?? 0,
            payments: census.counts.payments ?? 0,
            treatments: census.counts.patient_treatments ?? 0,
            appointments: census.counts.appointments ?? 0,
            total: census.total,
          }
        : null,
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
    if (this.readPeerValue('bootstrap_in_progress') === '1' && !this.readPeerValue('bootstrapped_at')) {
      return { pushed: 0, pulled: 0, conflicts: unresolvedConflictCount(this.db.connection), error: 'bootstrap-in-progress' };
    }
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
          conflicts?: Array<{ changeId: string; entity: string; recordUid: string; reason: string }>;
        };
        if (!res.ok) throw new Error(`push-failed-${res.status}`);
        if (!Array.isArray(data.accepted)) throw new Error('push-missing-ack');
        if (data.conflicts?.length) {
          recordInboundConflicts(this.db.connection, data.conflicts);
        }
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

      await this.reportCheckpoint(peer, token, since);
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

  async bootstrapOffline(): Promise<{ pulled: number; alreadyBootstrapped?: boolean }> {
    const peer = this.pairing.readPeerConfig();
    if (!peer) return { pulled: 0 };
    if (this.readPeerValue('bootstrapped_at')) {
      return { pulled: 0, alreadyBootstrapped: true };
    }
    if (this.running) {
      throw new BadRequestException('Sync is already running. Try bootstrap again in a moment.');
    }
    const inProgress = this.readPeerValue('bootstrap_in_progress') === '1';
    const census = clinicOperationalCensus(this.db.connection);
    if (census.populated && !inProgress) {
      throw new BadRequestException({
        statusCode: 400,
        message: populatedOfflineMessage(census),
        code: POPULATED_OFFLINE_CODE,
      });
    }
    this.running = true;
    let onlineCheckpoint: number | undefined;
    try {
      const token = await this.deviceToken(peer);
      this.writePeerValue('bootstrap_in_progress', '1');
      let pulled = 0;
      let afterEntity: string | undefined = this.readPeerValue('bootstrap_after_entity') || undefined;
      let afterId: number | undefined = Number(this.readPeerValue('bootstrap_after_id') || 0) || undefined;
      let complete = false;
      for (let i = 0; i < MAX_BOOTSTRAP_PAGES; i += 1) {
        const qs = new URLSearchParams();
        if (afterEntity) qs.set('afterEntity', afterEntity);
        if (afterId != null) qs.set('afterId', String(afterId));
        qs.set('limit', String(BOOTSTRAP_PAGE_SIZE));
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
        if (batch.length > 0) {
          applyChanges(this.db.connection, batch, 'online-server');
          pulled += batch.length;
          afterEntity = data.nextAfterEntity;
          afterId = data.nextAfterId;
          if (afterEntity) this.writePeerValue('bootstrap_after_entity', afterEntity);
          if (afterId != null) this.writePeerValue('bootstrap_after_id', String(afterId));
        }
        if (data.checkpoint != null) onlineCheckpoint = data.checkpoint;
        if (
          bootstrapSnapshotFinished({
            changesLength: batch.length,
            hasMore: data.hasMore,
            pageSize: BOOTSTRAP_PAGE_SIZE,
          })
        ) {
          complete = true;
          break;
        }
      }
      if (!complete) {
        throw new BadRequestException(
          `Snapshot download is not finished after ${MAX_BOOTSTRAP_PAGES} pages. Click Connect / bootstrap again — this computer is not fully synced yet.`,
        );
      }
      if (onlineCheckpoint != null) setCheckpoint(this.db.connection, onlineCheckpoint);
      await this.syncAttachmentBlobs(peer, token);
      const checkpoint = currentCheckpoint(this.db.connection);
      await this.reportCheckpoint(peer, token, checkpoint);
      this.writePeerValue('last_synced_at', new Date().toISOString());
      this.writePeerValue('bootstrapped_at', new Date().toISOString());
      this.writePeerValue('bootstrap_in_progress', '0');
      return { pulled };
    } finally {
      this.running = false;
    }
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
    const pending = rows.filter((row) => row.storedPath);
    const concurrency = 3;
    for (let i = 0; i < pending.length; i += concurrency) {
      const slice = pending.slice(i, i + concurrency);
      await Promise.all(slice.map((row) => this.syncOneAttachment(peer, token, row)));
    }
  }

  private async syncOneAttachment(
    peer: { onlineBaseUrl: string },
    token: string,
    row: { storedPath: string; mimeType: string | null },
  ): Promise<void> {
    const already = this.tableExists('sync_file_objects')
      ? (this.db.connection
          .prepare(`SELECT uploaded_at AS uploadedAt FROM sync_file_objects WHERE record_uid = ?`)
          .get(row.storedPath) as { uploadedAt?: string } | undefined)
      : undefined;
    const local = await this.objectStorage.getObject(row.storedPath);
    if (local && local.length > 0) {
      if (already?.uploadedAt) return;
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
      return;
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

  private async reportCheckpoint(
    peer: { onlineBaseUrl: string },
    token: string,
    seq: number,
  ): Promise<void> {
    const res = await this.onlineFetch(peer, token, '/api/sync/checkpoint', {
      method: 'POST',
      body: JSON.stringify({ seq }),
    });
    if (!res.ok) throw new Error(`checkpoint-failed-${res.status}`);
  }

  private onlineDeviceCount(): number {
    if (!this.platform.isEnabled()) return 0;
    const clinicId = getTenantClinicId();
    if (!clinicId) return 0;
    return this.platform.listSyncDevices(clinicId).filter((d: { revokedAt?: string | null }) => !d.revokedAt).length;
  }

  private onlineDevicesBehind(): number {
    if (!this.platform.isEnabled()) return 0;
    const clinicId = getTenantClinicId();
    if (!clinicId) return 0;
    const max = maxSeq(this.db.connection);
    return this.platform
      .listSyncDevices(clinicId)
      .filter((d: { revokedAt?: string | null; pullCheckpoint?: number }) => !d.revokedAt && Number(d.pullCheckpoint ?? 0) < max)
      .length;
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
