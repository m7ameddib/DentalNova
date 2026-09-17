import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from '../platform/platform.service';
import { SyncPairingService } from './sync-pairing.service';
import {
  applyChanges,
  canAdvancePullCheckpoint,
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
import { SyncChangePayload, SYNC_ENTITY_BY_NAME, IDENTITY_RECONCILE_ENTITY_SET } from './sync.entities';
import { ObjectStorageService } from '../storage/object-storage.service';
import { getTenantClinicId } from '../platform/tenant-context';
import { clinicOperationalCensus, OPERATIONAL_TABLES, POPULATED_OFFLINE_CODE, populatedOfflineMessage } from './clinic-census.util';
import { BOOTSTRAP_PAGE_SIZE, MAX_BOOTSTRAP_PAGES, bootstrapSnapshotFinished, snapshotOpeningCheckpoint } from './bootstrap.util';
import { ackPreBootstrapHoldOutbound } from './sync-schema';
import {
  describeOnlineReachabilityError,
  friendlyStoredSyncError,
  messageFromOnlineResponse,
} from './online-reachability.util';
import { PUSH_BATCH_MAX_ITEMS, PUSH_BATCH_MAX_JSON_BYTES, PUSH_MAX_ROUNDS, pushRoundFollowUp, splitPushBatch } from './push-batch.util';
import {
  canResumeIncompleteBootstrap,
  PULL_MAX_PAGES,
  rememberOpeningCheckpoint,
  shouldContinueSyncLoop,
  shouldRefreshDeviceToken,
  shouldRunBootstrapBeforeCycle,
} from './sync-cycle.util';
import {
  FILE_CHUNK_BYTES,
  FILE_INLINE_MAX_BYTES,
  FILE_MAX_BYTES,
  nextAttachmentRetryAt,
  sha256Hex,
  shouldRetryAttachment,
} from './sync-files.util';
import { syncProtocolHeaders } from './sync-protocol.util';

export type ClinicSyncState = 'SYNCED' | 'SYNCING' | 'PENDING' | 'OFFLINE' | 'ERROR' | 'CONFLICT';

type DeviceSession = { token: string; issuedAt: number };
type DevicePeer = { onlineBaseUrl: string; deviceId: string; deviceSecret: string };

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
    const bootstrappedAt = this.readPeerValue('bootstrapped_at');
    const needsBootstrap = Boolean(this.deployment.isOffline() && peer && !bootstrappedAt);
    const pending = this.deployment.isOnline() ? this.onlineDevicesBehind() : pendingCount(conn);
    const census = this.deployment.isOffline() ? clinicOperationalCensus(conn) : null;
    let state: ClinicSyncState = 'OFFLINE';
    if (this.running) {
      state = 'SYNCING';
    } else if (this.deployment.isOnline()) {
      state = conflicts > 0 ? 'CONFLICT' : lastError ? 'ERROR' : pending > 0 ? 'PENDING' : 'SYNCED';
    } else if (peer) {
      state = needsBootstrap
        ? lastError
          ? 'ERROR'
          : 'PENDING'
        : conflicts > 0
          ? 'CONFLICT'
          : lastError
            ? 'ERROR'
            : pending > 0
              ? 'PENDING'
              : 'SYNCED';
    }
    return {
      kind: this.deployment.isOnline() ? 'online-hub' : peer ? 'offline-peer' : 'none',
      state,
      paired: this.deployment.isOnline() ? this.onlineDeviceCount() > 0 : Boolean(peer),
      bootstrapped: Boolean(bootstrappedAt),
      needsBootstrap,
      pendingOutbound: pending,
      conflicts,
      lastSyncedAt: this.readPeerValue('last_synced_at'),
      lastError: friendlyStoredSyncError(this.readPeerValue('last_error')),
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
    const checkpoint = snapshotOpeningCheckpoint(maxSeq(this.db.connection));
    const { changes, nextAfterEntity, nextAfterId } = clinicSnapshot(
      this.db.connection,
      afterEntity,
      afterId ?? 0,
      limit,
    );
    return {
      changes,
      checkpoint,
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

  async runOfflineCycle(opts?: { forceAttachments?: boolean }): Promise<{ pushed: number; pulled: number; conflicts: number; error?: string }> {
    if (this.running) {
      return {
        pushed: 0,
        pulled: 0,
        conflicts: unresolvedConflictCount(this.db.connection),
        error: 'Sync is already running. Try again in a moment.',
      };
    }
    const peer = this.pairing.readPeerConfig();
    if (!peer) {
      return {
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        error: 'This computer is not paired with an Online clinic yet. Enter the pairing code and connect first.',
      };
    }
    this.running = true;
    this.writePeerValue('last_error', '');
    let pushed = 0;
    let pulled = 0;
    const cycleStarted = Date.now();
    try {
      const session = await this.newDeviceSession(peer);
      if (shouldRunBootstrapBeforeCycle(this.readPeerValue('bootstrapped_at'))) {
        const boot = await this.executeBootstrapUnlocked(peer, session);
        pulled += boot.pulled;
        Object.assign(session, await this.newDeviceSession(peer));
      } else {
        await this.reconcileCatalogIdentity(peer, session.token);
      }
      let maxItems = PUSH_BATCH_MAX_ITEMS;
      let maxBytes = PUSH_BATCH_MAX_JSON_BYTES;
      const skipThisCycle = new Set<string>();
      for (let round = 0; round < PUSH_MAX_ROUNDS; round += 1) {
        if (
          !shouldContinueSyncLoop({
            startedAtMs: cycleStarted,
            nowMs: Date.now(),
            round,
            maxRounds: PUSH_MAX_ROUNDS,
            madeProgress: true,
            exhausted: false,
          })
        ) {
          break;
        }
        await this.refreshDeviceSession(peer, session);
        const outbound = pendingOutbound(this.db.connection, 200, skipThisCycle);
        if (outbound.length === 0) break;
        const batch = splitPushBatch(outbound, maxItems, maxBytes);
        const res = await this.onlineFetch(peer, session.token, '/api/sync/push', {
          method: 'POST',
          body: JSON.stringify({ changes: batch }),
        });
        const data = await this.readOnlineJson<{
          accepted?: string[];
          skipped?: string[];
          conflicts?: Array<{
            changeId: string;
            entity: string;
            recordUid: string;
            reason: string;
            row?: Record<string, unknown> | null;
            current?: Record<string, unknown> | null;
          }>;
          message?: unknown;
        }>(res);
        if (res.status === 413 && batch.length > 1) {
          maxItems = Math.max(1, Math.floor(batch.length / 2));
          maxBytes = Math.max(8_000, Math.floor(maxBytes / 2));
          continue;
        }
        if (!res.ok) {
          throw new Error(
            messageFromOnlineResponse(res.status, data, `Could not upload clinic changes (HTTP ${res.status}).`),
          );
        }
        if (!Array.isArray(data.accepted)) throw new Error('The Online clinic did not acknowledge uploaded changes.');
        if (data.conflicts?.length) {
          recordInboundConflicts(this.db.connection, data.conflicts);
        }
        const follow = pushRoundFollowUp({
          batchIds: batch.map((change) => change.changeId),
          accepted: data.accepted,
          skipped: data.skipped ?? [],
        });
        markAcked(this.db.connection, follow.acked);
        pushed += data.accepted.length;
        for (const id of follow.skipThisCycle) skipThisCycle.add(id);
      }

      pulled += await this.pullRemoteChanges(peer, session, cycleStarted);
      const since = currentCheckpoint(this.db.connection);
      await this.reportCheckpoint(peer, session.token, since);
      await this.syncAttachmentBlobs(peer, session.token, Boolean(opts?.forceAttachments));
      this.writePeerValue('last_synced_at', new Date().toISOString());
      return { pushed, pulled, conflicts: unresolvedConflictCount(this.db.connection) };
    } catch (err) {
      const message = this.userFacingSyncFailure(err);
      this.logger.warn(`Offline sync cycle failed: ${message}`);
      this.writePeerValue('last_error', message);
      return { pushed, pulled, conflicts: unresolvedConflictCount(this.db.connection), error: message };
    } finally {
      this.running = false;
    }
  }

  async bootstrapOffline(): Promise<{ pulled: number; alreadyBootstrapped?: boolean }> {
    const peer = this.pairing.readPeerConfig();
    if (!peer) {
      throw new BadRequestException(
        'This computer is not paired with an Online clinic yet. Enter the pairing code and connect first.',
      );
    }
    if (this.readPeerValue('bootstrapped_at')) {
      return { pulled: 0, alreadyBootstrapped: true };
    }
    if (this.running) {
      throw new BadRequestException('Sync is already running. Try bootstrap again in a moment.');
    }
    const census = clinicOperationalCensus(this.db.connection);
    const resumable = canResumeIncompleteBootstrap({
      bootstrappedAt: this.readPeerValue('bootstrapped_at'),
      bootstrapStarted: this.readPeerValue('bootstrap_started'),
    });
    if (census.populated && !resumable) {
      throw new BadRequestException({
        statusCode: 400,
        message: populatedOfflineMessage(census),
        code: POPULATED_OFFLINE_CODE,
      });
    }
    this.running = true;
    try {
      const session = await this.newDeviceSession(peer);
      return await this.executeBootstrapUnlocked(peer, session);
    } catch (err) {
      if (err instanceof BadRequestException) {
        this.writePeerValue('last_error', this.httpExceptionMessage(err));
        throw err;
      }
      const message = this.userFacingSyncFailure(err);
      this.writePeerValue('last_error', message);
      throw new BadRequestException(message);
    } finally {
      if (!this.readPeerValue('bootstrapped_at')) {
        this.writePeerValue('bootstrap_in_progress', '0');
      }
      this.running = false;
    }
  }

  private async executeBootstrapUnlocked(
    peer: DevicePeer,
    session: DeviceSession,
  ): Promise<{ pulled: number }> {
    this.writePeerValue('bootstrap_started', '1');
    this.writePeerValue('bootstrap_in_progress', '1');
    try {
    let pulled = 0;
    let afterEntity: string | undefined = this.readPeerValue('bootstrap_after_entity') || undefined;
    let afterId: number | undefined = Number(this.readPeerValue('bootstrap_after_id') || 0) || undefined;
    let openingCheckpoint: number | undefined;
    let complete = false;
    for (let i = 0; i < MAX_BOOTSTRAP_PAGES; i += 1) {
      if (this.hasLocalOperationalPending()) {
        throw new BadRequestException(
          'Local clinic records were saved during the first download. Use an empty Offline install and pair again — two databases are never merged.',
        );
      }
      await this.refreshDeviceSession(peer, session);
      const qs = new URLSearchParams();
      if (afterEntity) qs.set('afterEntity', afterEntity);
      if (afterId != null) qs.set('afterId', String(afterId));
      qs.set('limit', String(BOOTSTRAP_PAGE_SIZE));
      const res = await this.onlineFetch(peer, session.token, `/api/sync/snapshot?${qs.toString()}`, { method: 'GET' });
      const data = await this.readOnlineJson<{
        changes?: SyncChangePayload[];
        checkpoint?: number;
        hasMore?: boolean;
        nextAfterEntity?: string;
        nextAfterId?: number;
        message?: unknown;
      }>(res);
      if (!res.ok) {
        throw new Error(
          messageFromOnlineResponse(res.status, data, `Could not download the clinic snapshot (HTTP ${res.status}).`),
        );
      }
      openingCheckpoint = rememberOpeningCheckpoint(openingCheckpoint, data.checkpoint);
      const batch = data.changes ?? [];
      if (batch.length > 0) {
        const applied = applyChanges(this.db.connection, batch, 'online-server');
        pulled += applied.accepted.length;
        afterEntity = data.nextAfterEntity;
        afterId = data.nextAfterId;
        if (afterEntity) this.writePeerValue('bootstrap_after_entity', afterEntity);
        if (afterId != null) this.writePeerValue('bootstrap_after_id', String(afterId));
      }
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
        `Snapshot download is not finished after ${MAX_BOOTSTRAP_PAGES} pages. Click Sync now — this computer is not fully synced yet.`,
      );
    }
    if (openingCheckpoint != null) setCheckpoint(this.db.connection, openingCheckpoint);
    pulled += await this.pullRemoteChanges(peer, session);
    ackPreBootstrapHoldOutbound(this.db.connection);
    this.writePeerValue('catalog_uids_reconciled', '1');
    await this.syncAttachmentBlobs(peer, session.token, true);
    const checkpoint = currentCheckpoint(this.db.connection);
    await this.reportCheckpoint(peer, session.token, checkpoint);
    this.writePeerValue('last_synced_at', new Date().toISOString());
    this.writePeerValue('bootstrapped_at', new Date().toISOString());
    this.writePeerValue('bootstrap_in_progress', '0');
    this.writePeerValue('last_error', '');
    return { pulled };
    } finally {
      if (!this.readPeerValue('bootstrapped_at')) {
        this.writePeerValue('bootstrap_in_progress', '0');
      }
    }
  }

  private async pullRemoteChanges(peer: DevicePeer, session: DeviceSession, cycleStartedMs = Date.now()): Promise<number> {
    let pulled = 0;
    let since = currentCheckpoint(this.db.connection);
    for (let round = 0; round < PULL_MAX_PAGES; round += 1) {
      if (
        !shouldContinueSyncLoop({
          startedAtMs: cycleStartedMs,
          nowMs: Date.now(),
          round,
          maxRounds: PULL_MAX_PAGES,
          madeProgress: true,
          exhausted: false,
        })
      ) {
        break;
      }
      await this.refreshDeviceSession(peer, session);
      const res = await this.onlineFetch(peer, session.token, `/api/sync/changes?since=${since}&limit=100`, {
        method: 'GET',
      });
      const data = await this.readOnlineJson<{
        changes?: SyncChangePayload[];
        until?: number;
        hasMore?: boolean;
        message?: unknown;
      }>(res);
      if (!res.ok) {
        throw new Error(
          messageFromOnlineResponse(res.status, data, `Could not download clinic changes (HTTP ${res.status}).`),
        );
      }
      const batch = data.changes ?? [];
      if (batch.length === 0) break;
      const applied = applyChanges(this.db.connection, batch, 'online-server');
      pulled += applied.accepted.length;
      if (!canAdvancePullCheckpoint(applied)) {
        break;
      }
      since = data.until ?? since;
      setCheckpoint(this.db.connection, since);
      if (!data.hasMore) break;
    }
    return pulled;
  }

  private async newDeviceSession(peer: DevicePeer): Promise<DeviceSession> {
    return { token: await this.deviceToken(peer), issuedAt: Date.now() };
  }

  private async refreshDeviceSession(peer: DevicePeer, session: DeviceSession): Promise<void> {
    if (!shouldRefreshDeviceToken(session.issuedAt, Date.now())) return;
    session.token = await this.deviceToken(peer);
    session.issuedAt = Date.now();
  }

  async putFileFromDevice(relativePath: string, bytes: Buffer, mimeType?: string) {
    if (!relativePath?.trim()) throw new Error('Invalid storage path');
    if (bytes.length > FILE_INLINE_MAX_BYTES) throw new Error('File is too large for a single request');
    await this.objectStorage.putObject(relativePath, bytes, mimeType);
    return { stored: relativePath, bytes: bytes.length, sha256: sha256Hex(bytes) };
  }

  async beginFileFromDevice(relativePath: string, byteSize: number, mimeType?: string, sha256?: string) {
    if (!relativePath?.trim()) throw new Error('Invalid storage path');
    if (!Number.isFinite(byteSize) || byteSize < 1 || byteSize > FILE_MAX_BYTES) {
      throw new Error('File size is not allowed');
    }
    this.objectStorage.beginPartial(relativePath, byteSize);
    return { started: relativePath, byteSize, mimeType: mimeType || null, sha256: sha256 || null };
  }

  async putFileChunkFromDevice(relativePath: string, offset: number, bytes: Buffer) {
    if (!relativePath?.trim()) throw new Error('Invalid storage path');
    const expected = this.partialExpectedSize(relativePath);
    const result = this.objectStorage.writePartialRange(relativePath, offset, bytes, expected);
    return { stored: relativePath, offset, bytes: bytes.length, received: result.received };
  }

  async finishFileFromDevice(relativePath: string, sha256: string, mimeType?: string) {
    if (!relativePath?.trim()) throw new Error('Invalid storage path');
    const result = await this.objectStorage.finalizePartial(relativePath, sha256, mimeType);
    return { stored: relativePath, bytes: result.bytes, sha256: result.sha256 };
  }

  async getFileForDevice(relativePath: string) {
    return this.objectStorage.getObject(relativePath);
  }

  async getFileMetaOrInlineForDevice(relativePath: string) {
    const stat = this.objectStorage.localStat(relativePath);
    if (!stat) {
      const bytes = await this.objectStorage.getObject(relativePath);
      if (!bytes) return { found: false };
      if (bytes.length > FILE_INLINE_MAX_BYTES) {
        return { found: true, byteSize: bytes.length, sha256: sha256Hex(bytes), chunked: true };
      }
      return { found: true, byteSize: bytes.length, sha256: sha256Hex(bytes), contentBase64: bytes.toString('base64') };
    }
    if (stat.bytes > FILE_INLINE_MAX_BYTES) {
      return { found: true, byteSize: stat.bytes, sha256: stat.sha256, chunked: true };
    }
    const bytes = await this.objectStorage.getObject(relativePath);
    if (!bytes) return { found: false };
    return { found: true, byteSize: bytes.length, sha256: sha256Hex(bytes), contentBase64: bytes.toString('base64') };
  }

  async getFileChunkForDevice(relativePath: string, offset: number, limit: number) {
    const stat = this.objectStorage.localStat(relativePath);
    if (!stat) {
      const full = await this.objectStorage.getObject(relativePath);
      if (!full) return { found: false };
      const take = Math.min(limit > 0 ? limit : FILE_CHUNK_BYTES, FILE_CHUNK_BYTES, Math.max(0, full.length - offset));
      const slice = full.subarray(offset, offset + take);
      return {
        found: true,
        offset,
        byteSize: full.length,
        sha256: sha256Hex(full),
        contentBase64: slice.toString('base64'),
        hasMore: offset + slice.length < full.length,
      };
    }
    const take = Math.min(limit > 0 ? limit : FILE_CHUNK_BYTES, FILE_CHUNK_BYTES);
    const slice = this.objectStorage.readRange(relativePath, offset, take);
    if (slice == null) return { found: false };
    return {
      found: true,
      offset,
      byteSize: stat.bytes,
      sha256: stat.sha256,
      contentBase64: slice.toString('base64'),
      hasMore: offset + slice.length < stat.bytes,
    };
  }

  private partialExpectedSize(relativePath: string): number {
    const part = `${relativePath}.part`;
    const metaPath = this.objectStorage.localStat(part);
    if (metaPath) return metaPath.bytes;
    throw new Error('File upload has not started');
  }

  private async syncAttachmentBlobs(
    peer: { onlineBaseUrl: string },
    token: string,
    force = false,
  ): Promise<void> {
    if (!this.tableExists('patient_attachments')) return;
    const rows = this.db.connection
      .prepare(`SELECT stored_path AS storedPath, mime_type AS mimeType FROM patient_attachments`)
      .all() as Array<{ storedPath: string; mimeType: string | null }>;
    const pending = rows.filter((row) => row.storedPath);
    const concurrency = 3;
    for (let i = 0; i < pending.length; i += concurrency) {
      const slice = pending.slice(i, i + concurrency);
      await Promise.all(slice.map((row) => this.syncOneAttachment(peer, token, row, force)));
    }
  }

  private async syncOneAttachment(
    peer: { onlineBaseUrl: string },
    token: string,
    row: { storedPath: string; mimeType: string | null },
    force = false,
  ): Promise<void> {
    try {
      const state = this.fileSyncState(row.storedPath);
      if (
        !shouldRetryAttachment({
          uploadedAt: state?.uploadedAt,
          attemptCount: state?.attemptCount,
          nextRetryAt: state?.nextRetryAt,
          force,
        })
      ) {
        return;
      }
      const local = await this.objectStorage.getObject(row.storedPath);
      if (local && local.length > 0) {
        if (state?.uploadedAt) return;
        await this.uploadAttachmentBytes(peer, token, row, local);
        return;
      }
      await this.downloadAttachmentBytes(peer, token, row);
    } catch (err) {
      this.markFileError(row.storedPath, (err as Error).message || 'sync-failed');
    }
  }

  private async uploadAttachmentBytes(
    peer: { onlineBaseUrl: string },
    token: string,
    row: { storedPath: string; mimeType: string | null },
    local: Buffer,
  ): Promise<void> {
    const digest = sha256Hex(local);
    if (local.length <= FILE_INLINE_MAX_BYTES) {
      const res = await this.onlineFetch(peer, token, '/api/sync/files', {
        method: 'POST',
        body: JSON.stringify({
          relativePath: row.storedPath,
          contentBase64: local.toString('base64'),
          mimeType: row.mimeType,
        }),
      });
      if (res.ok) this.markFileUploaded(row.storedPath, local.length, row.mimeType, digest);
      else this.markFileError(row.storedPath, `upload-${res.status}`);
      return;
    }
    const begin = await this.onlineFetch(peer, token, '/api/sync/files/begin', {
      method: 'POST',
      body: JSON.stringify({
        relativePath: row.storedPath,
        mimeType: row.mimeType,
        byteSize: local.length,
        sha256: digest,
      }),
    });
    if (!begin.ok) {
      this.markFileError(row.storedPath, `upload-begin-${begin.status}`);
      return;
    }
    for (let offset = 0; offset < local.length; offset += FILE_CHUNK_BYTES) {
      const slice = local.subarray(offset, offset + FILE_CHUNK_BYTES);
      const chunkRes = await this.onlineFetch(peer, token, '/api/sync/files/chunk', {
        method: 'POST',
        body: JSON.stringify({
          relativePath: row.storedPath,
          offset,
          contentBase64: slice.toString('base64'),
        }),
      });
      if (!chunkRes.ok) {
        this.markFileError(row.storedPath, `upload-chunk-${chunkRes.status}`);
        return;
      }
    }
    const finish = await this.onlineFetch(peer, token, '/api/sync/files/finish', {
      method: 'POST',
      body: JSON.stringify({
        relativePath: row.storedPath,
        sha256: digest,
        mimeType: row.mimeType,
      }),
    });
    if (finish.ok) this.markFileUploaded(row.storedPath, local.length, row.mimeType, digest);
    else this.markFileError(row.storedPath, `upload-finish-${finish.status}`);
  }

  private async downloadAttachmentBytes(
    peer: { onlineBaseUrl: string },
    token: string,
    row: { storedPath: string; mimeType: string | null },
  ): Promise<void> {
    const metaRes = await this.onlineFetch(
      peer,
      token,
      `/api/sync/files?path=${encodeURIComponent(row.storedPath)}`,
      { method: 'GET' },
    );
    const meta = (await metaRes.json().catch(() => ({}))) as {
      found?: boolean;
      contentBase64?: string;
      chunked?: boolean;
      byteSize?: number;
      sha256?: string;
    };
    if (!metaRes.ok) {
      this.markFileError(row.storedPath, `download-${metaRes.status}`);
      return;
    }
    if (!meta.found) return;
    if (meta.contentBase64 && !meta.chunked) {
      const bytes = Buffer.from(meta.contentBase64, 'base64');
      await this.objectStorage.putObject(row.storedPath, bytes, row.mimeType);
      this.markFileUploaded(row.storedPath, bytes.length, row.mimeType, sha256Hex(bytes));
      return;
    }
    const total = Number(meta.byteSize) || 0;
    if (total < 1 || total > FILE_MAX_BYTES) {
      this.markFileError(row.storedPath, 'download-size');
      return;
    }
    const chunks: Buffer[] = [];
    for (let offset = 0; offset < total; offset += FILE_CHUNK_BYTES) {
      const qs = new URLSearchParams({
        path: row.storedPath,
        offset: String(offset),
        limit: String(FILE_CHUNK_BYTES),
      });
      const chunkRes = await this.onlineFetch(peer, token, `/api/sync/files?${qs.toString()}`, { method: 'GET' });
      const data = (await chunkRes.json().catch(() => ({}))) as { found?: boolean; contentBase64?: string };
      if (!chunkRes.ok || !data.found || !data.contentBase64) {
        this.markFileError(row.storedPath, `download-chunk-${chunkRes.status}`);
        return;
      }
      chunks.push(Buffer.from(data.contentBase64, 'base64'));
    }
    const bytes = Buffer.concat(chunks);
    if (meta.sha256 && sha256Hex(bytes) !== meta.sha256) {
      this.markFileError(row.storedPath, 'download-checksum');
      return;
    }
    await this.objectStorage.putObject(row.storedPath, bytes, row.mimeType);
    this.markFileUploaded(row.storedPath, bytes.length, row.mimeType, sha256Hex(bytes));
  }

  private fileSyncState(relativePath: string): {
    uploadedAt?: string | null;
    attemptCount?: number;
    nextRetryAt?: string | null;
  } | undefined {
    if (!this.tableExists('sync_file_objects')) return undefined;
    return this.db.connection
      .prepare(
        `SELECT uploaded_at AS uploadedAt, attempt_count AS attemptCount, next_retry_at AS nextRetryAt
         FROM sync_file_objects WHERE record_uid = ?`,
      )
      .get(relativePath) as
      | { uploadedAt?: string | null; attemptCount?: number; nextRetryAt?: string | null }
      | undefined;
  }

  private markFileUploaded(relativePath: string, byteSize: number, mimeType: string | null, sha256?: string): void {
    if (!this.tableExists('sync_file_objects')) return;
    this.db.connection
      .prepare(
        `INSERT INTO sync_file_objects (record_uid, relative_path, mime_type, byte_size, sha256, uploaded_at, last_error, attempt_count, next_retry_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), NULL, 0, NULL)
         ON CONFLICT(record_uid) DO UPDATE SET
           relative_path = excluded.relative_path,
           mime_type = excluded.mime_type,
           byte_size = excluded.byte_size,
           sha256 = excluded.sha256,
           uploaded_at = excluded.uploaded_at,
           last_error = NULL,
           attempt_count = 0,
           next_retry_at = NULL`,
      )
      .run(relativePath, relativePath, mimeType, byteSize, sha256 ?? null);
  }

  private markFileError(relativePath: string, error: string): void {
    if (!this.tableExists('sync_file_objects')) return;
    const current = this.fileSyncState(relativePath);
    const attempts = (Number(current?.attemptCount) || 0) + 1;
    this.db.connection
      .prepare(
        `INSERT INTO sync_file_objects (record_uid, relative_path, last_error, attempt_count, next_retry_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(record_uid) DO UPDATE SET
           last_error = excluded.last_error,
           attempt_count = excluded.attempt_count,
           next_retry_at = excluded.next_retry_at`,
      )
      .run(relativePath, relativePath, error.slice(0, 300), attempts, nextAttachmentRetryAt(attempts - 1));
  }

  private tableExists(name: string): boolean {
    const row = this.db.connection
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(name);
    return Boolean(row);
  }

  private async reconcileCatalogIdentity(
    peer: { onlineBaseUrl: string },
    token: string,
  ): Promise<void> {
    if (this.readPeerValue('catalog_uids_reconciled') === '1') return;
    let afterEntity: string | undefined;
    let afterId: number | undefined;
    for (let i = 0; i < MAX_BOOTSTRAP_PAGES; i += 1) {
      const qs = new URLSearchParams();
      if (afterEntity) qs.set('afterEntity', afterEntity);
      if (afterId != null) qs.set('afterId', String(afterId));
      qs.set('limit', String(BOOTSTRAP_PAGE_SIZE));
      const res = await this.onlineFetch(peer, token, `/api/sync/snapshot?${qs.toString()}`, { method: 'GET' });
      const data = await this.readOnlineJson<{
        changes?: SyncChangePayload[];
        hasMore?: boolean;
        nextAfterEntity?: string;
        nextAfterId?: number;
      }>(res);
      if (!res.ok) {
        throw new Error(
          messageFromOnlineResponse(res.status, data, `Could not reconcile clinic catalogs (HTTP ${res.status}).`),
        );
      }
      const batch = (data.changes ?? []).filter((change) => IDENTITY_RECONCILE_ENTITY_SET.has(change.entity));
      if (batch.length > 0) applyChanges(this.db.connection, batch, 'online-server');
      afterEntity = data.nextAfterEntity;
      afterId = data.nextAfterId;
      const finished = bootstrapSnapshotFinished({
        changesLength: data.changes?.length ?? 0,
        hasMore: data.hasMore,
        pageSize: BOOTSTRAP_PAGE_SIZE,
      });
      const pastCatalogs =
        Boolean(afterEntity) && !IDENTITY_RECONCILE_ENTITY_SET.has(afterEntity as string) && batch.length === 0;
      if (finished || pastCatalogs) break;
    }
    ackPreBootstrapHoldOutbound(this.db.connection);
    this.writePeerValue('catalog_uids_reconciled', '1');
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
    if (!res.ok) {
      const data = await this.readOnlineJson<{ message?: unknown }>(res);
      throw new Error(
        messageFromOnlineResponse(res.status, data, `Could not save the sync checkpoint (HTTP ${res.status}).`),
      );
    }
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
    let res: Response;
    try {
      res = await fetch(`${peer.onlineBaseUrl}/api/sync/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...syncProtocolHeaders() },
        body: JSON.stringify({ deviceId: peer.deviceId, deviceSecret: peer.deviceSecret }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new Error(describeOnlineReachabilityError(err));
    }
    const data = await this.readOnlineJson<{ accessToken?: string; message?: unknown }>(res);
    if (!res.ok || !data.accessToken) {
      throw new Error(
        messageFromOnlineResponse(
          res.status,
          data,
          'This computer could not sign in to the Online clinic. Pair again with a new code if the device was revoked.',
        ),
      );
    }
    return data.accessToken;
  }

  private async onlineFetch(peer: { onlineBaseUrl: string }, token: string, path: string, init: RequestInit) {
    try {
      return await fetch(`${peer.onlineBaseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...syncProtocolHeaders(),
          ...(init.headers || {}),
        },
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      throw new Error(describeOnlineReachabilityError(err));
    }
  }

  private async readOnlineJson<T>(res: Response): Promise<T & { message?: unknown }> {
    return ((await res.json().catch(() => ({}))) as T & { message?: unknown }) ?? ({} as T & { message?: unknown });
  }

  private userFacingSyncFailure(err: unknown): string {
    if (err instanceof BadRequestException) return this.httpExceptionMessage(err);
    const message = (err as Error)?.message?.trim();
    if (message) return message;
    return describeOnlineReachabilityError(err);
  }

  private httpExceptionMessage(err: BadRequestException): string {
    const raw = err.getResponse();
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (raw && typeof raw === 'object' && typeof (raw as { message?: unknown }).message === 'string') {
      return String((raw as { message: string }).message);
    }
    return err.message || 'Request failed.';
  }

  /** Local operational writes during bootstrap mean the Offline DB is no longer an empty snapshot target. */
  private hasLocalOperationalPending(): boolean {
    const operational = new Set<string>(OPERATIONAL_TABLES);
    return pendingOutbound(this.db.connection, 80).some((change) => {
      const table = SYNC_ENTITY_BY_NAME[change.entity]?.table;
      return Boolean(table && operational.has(table));
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
