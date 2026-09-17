import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOTSTRAP_PAGE_SIZE,
  MAX_BOOTSTRAP_PAGES,
  bootstrapSnapshotFinished,
  shouldFinalizeBootstrap,
  snapshotOpeningCheckpoint,
} from './bootstrap.util';

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
