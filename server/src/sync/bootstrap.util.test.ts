import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOTSTRAP_PAGE_SIZE,
  MAX_BOOTSTRAP_PAGES,
  bootstrapSnapshotFinished,
  initialSnapshotCursor,
  normalizeSnapshotCursor,
  shouldFinalizeBootstrap,
  snapshotOpeningCheckpoint,
  snapshotRequestMatchesCursor,
} from './bootstrap.util';

test('snapshot bootstrap only advances when the device walks from the start cursor', () => {
  const start = initialSnapshotCursor();
  assert.equal(snapshotRequestMatchesCursor(normalizeSnapshotCursor(undefined, 0), start), true);
  assert.equal(snapshotRequestMatchesCursor(normalizeSnapshotCursor('patients', 999), start), false);
  assert.equal(
    snapshotRequestMatchesCursor(normalizeSnapshotCursor('patients', 80), normalizeSnapshotCursor('patients', 80)),
    true,
  );
});

test('incomplete snapshot pages must not be marked bootstrapped', () => {
  assert.equal(bootstrapSnapshotFinished({ changesLength: BOOTSTRAP_PAGE_SIZE, hasMore: true }), false);
  assert.equal(shouldFinalizeBootstrap(false), false);
  assert.equal(MAX_BOOTSTRAP_PAGES > 50, true);
});

test('empty, short, or final snapshot page completes bootstrap', () => {
  assert.equal(bootstrapSnapshotFinished({ changesLength: 0, hasMore: true }), false);
  assert.equal(bootstrapSnapshotFinished({ changesLength: 0, hasMore: false }), true);
  assert.equal(bootstrapSnapshotFinished({ changesLength: 0 }), true);
  assert.equal(bootstrapSnapshotFinished({ changesLength: 12, hasMore: false }), true);
  assert.equal(bootstrapSnapshotFinished({ changesLength: 12 }), true);
  assert.equal(shouldFinalizeBootstrap(true), true);
  assert.equal(snapshotOpeningCheckpoint(0), 0);
  assert.equal(snapshotOpeningCheckpoint(41), 41);
});
