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
