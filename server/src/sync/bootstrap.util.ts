/** Max snapshot pages per bootstrap call. 80 rows/page × 500 = 40,000 rows. */
export const MAX_BOOTSTRAP_PAGES = 500;
export const BOOTSTRAP_PAGE_SIZE = 80;

export function bootstrapSnapshotFinished(page: {
  changesLength: number;
  hasMore?: boolean;
  pageSize?: number;
}): boolean {
  if (page.changesLength === 0) return page.hasMore !== true;
  if (page.hasMore === false) return true;
  const size = page.pageSize ?? BOOTSTRAP_PAGE_SIZE;
  if (page.hasMore !== true && page.changesLength < size) return true;
  return false;
}

export function shouldFinalizeBootstrap(complete: boolean): boolean {
  return complete;
}

/** Capture maxSeq before reading snapshot rows so concurrent inserts are not skipped. */
export function snapshotOpeningCheckpoint(maxSeqNow: number): number {
  return Number(maxSeqNow) || 0;
}

export type SnapshotCursor = { afterEntity: string; afterId: number };

export const DEVICE_BOOTSTRAP_REQUIRED_CODE = 'DEVICE_BOOTSTRAP_REQUIRED';
export const DEVICE_BOOTSTRAP_REQUIRED_MESSAGE =
  'This computer must finish the first clinic download before it can upload records. Two databases are never merged.';

export function normalizeSnapshotCursor(afterEntity?: string | null, afterId?: number | null): SnapshotCursor {
  return { afterEntity: String(afterEntity || ''), afterId: Number(afterId) || 0 };
}

export function snapshotRequestMatchesCursor(requested: SnapshotCursor, expected: SnapshotCursor): boolean {
  return requested.afterEntity === expected.afterEntity && requested.afterId === expected.afterId;
}

export function initialSnapshotCursor(): SnapshotCursor {
  return { afterEntity: '', afterId: 0 };
}
