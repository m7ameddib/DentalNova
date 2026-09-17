import { SyncChangePayload } from './sync.entities';

/** Stay under Express/Nest default 100kb and typical reverse-proxy limits. */
export const PUSH_BATCH_MAX_ITEMS = 40;
export const PUSH_BATCH_MAX_JSON_BYTES = 80_000;
export const PUSH_MAX_ROUNDS = 500;

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

/**
 * Take a prefix of pending changes that fits in one POST /api/sync/push body.
 * A single oversized row is still returned so the Online server can reject it clearly.
 */
export function splitPushBatch(
  changes: SyncChangePayload[],
  maxItems = PUSH_BATCH_MAX_ITEMS,
  maxJsonBytes = PUSH_BATCH_MAX_JSON_BYTES,
): SyncChangePayload[] {
  if (changes.length === 0) return [];
  const batch: SyncChangePayload[] = [];
  let size = jsonBytes({ changes: [] });
  for (const change of changes) {
    const piece = jsonBytes(change);
    const extra = batch.length === 0 ? piece : piece + 1;
    if (batch.length >= maxItems) break;
    if (batch.length > 0 && size + extra > maxJsonBytes) break;
    batch.push(change);
    size += extra;
  }
  if (batch.length === 0) return [changes[0]];
  return batch;
}

/**
 * Ack accepted/skipped ids; park the rest of this batch so UNIQUE catalog
 * conflicts cannot block later operational rows in the same cycle.
 */
export function pushRoundFollowUp(input: {
  batchIds: string[];
  accepted: string[];
  skipped: string[];
}): { acked: string[]; skipThisCycle: string[] } {
  const done = new Set([...input.accepted, ...input.skipped]);
  return {
    acked: [...done],
    skipThisCycle: input.batchIds.filter((id) => !done.has(id)),
  };
}
