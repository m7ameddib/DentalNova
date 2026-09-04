/**
 * Contract for a future online synchronization layer. Not implemented in
 * this phase — the app works entirely offline against the local SQLite
 * database. This interface exists so a concrete implementation (e.g. REST
 * push/pull against a cloud API, or a queue-based sync) can be dropped in
 * later without touching services or controllers.
 *
 * Every syncable table already carries `sync_status` (LOCAL | PENDING |
 * SYNCED) and `updated_at`, which a real implementation would use to find
 * outbound changes and resolve conflicts.
 */
export interface SyncChangeSet {
  entity: 'patient' | 'appointment' | 'patientTreatment' | 'payment';
  records: Record<string, unknown>[];
}

export interface SyncProvider {
  /** Push local pending changes to the remote store. */
  push(): Promise<{ pushed: number }>;
  /** Pull remote changes into the local store. */
  pull(): Promise<{ pulled: number }>;
  /** Whether sync is currently enabled/configured. */
  isEnabled(): boolean;
}

/** No-op implementation used while online sync is not yet built. */
export class DisabledSyncProvider implements SyncProvider {
  async push() {
    return { pushed: 0 };
  }
  async pull() {
    return { pulled: 0 };
  }
  isEnabled() {
    return false;
  }
}
