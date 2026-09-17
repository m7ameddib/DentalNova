import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_TOKEN_REFRESH_AFTER_MS,
  canResumeIncompleteBootstrap,
  rememberOpeningCheckpoint,
  remoteRowFromConflictJson,
  shouldRefreshDeviceToken,
  shouldRunBootstrapBeforeCycle,
  shouldContinueSyncLoop,
  PULL_MAX_PAGES,
  SYNC_CYCLE_MAX_MS,
} from './sync-cycle.util';
import { snapshotOpeningCheckpoint } from './bootstrap.util';
import { immutableApplyDecision, isVoidedRow } from './sync.entities';

test('failed bootstrap stays resumable and is not treated as finished', () => {
  assert.equal(shouldRunBootstrapBeforeCycle(null), true);
  assert.equal(shouldRunBootstrapBeforeCycle('2026-09-17T00:00:00Z'), false);
  assert.equal(canResumeIncompleteBootstrap({ bootstrappedAt: null, bootstrapStarted: '1' }), true);
  assert.equal(canResumeIncompleteBootstrap({ bootstrappedAt: null, bootstrapStarted: null }), false);
  assert.equal(
    canResumeIncompleteBootstrap({ bootstrappedAt: '2026-09-17T00:00:00Z', bootstrapStarted: '1' }),
    false,
  );
});

test('opening checkpoint keeps the first snapshot page seq, not a later maxSeq', () => {
  assert.equal(snapshotOpeningCheckpoint(12), 12);
  assert.equal(rememberOpeningCheckpoint(undefined, 10), 10);
  assert.equal(rememberOpeningCheckpoint(10, 44), 10);
  assert.equal(rememberOpeningCheckpoint(10, undefined), 10);
});

test('device JWT is refreshed after one hour during long sync loops', () => {
  const issued = 1_000_000;
  assert.equal(shouldRefreshDeviceToken(issued, issued + 59 * 60 * 1000), false);
  assert.equal(shouldRefreshDeviceToken(issued, issued + DEVICE_TOKEN_REFRESH_AFTER_MS), true);
  assert.equal(shouldRefreshDeviceToken(0, issued), true);
});

test('inbound push conflict envelopes unwrap to the real row for keep_remote', () => {
  const row = { fullName: 'Ada', phone: '079' };
  assert.deepEqual(remoteRowFromConflictJson(row), row);
  assert.deepEqual(
    remoteRowFromConflictJson({ changeId: 'c1', entity: 'patients', recordUid: 'u', reason: 'concurrent-edit', row }),
    row,
  );
  assert.equal(remoteRowFromConflictJson(null), null);
});

test('immutable payments allow void-only transitions and reject amount edits', () => {
  const active = {
    patientUid: 'p1',
    amountCents: 1000,
    date: '2026-01-01',
    method: 'CASH',
    status: 'ACTIVE',
  };
  assert.equal(isVoidedRow({ status: 'VOID' }), true);
  assert.equal(
    immutableApplyDecision(active, { ...active, status: 'VOID', voidedAt: '2026-01-02' }),
    'apply-void',
  );
  assert.equal(immutableApplyDecision(active, { ...active, amountCents: 5000 }), 'conflict');
  assert.equal(
    immutableApplyDecision(
      { ...active, status: 'VOID', voidedAt: '2026-01-02' },
      { ...active, status: 'VOID', voidedAt: '2026-01-02', amountCents: 5000 },
    ),
    'conflict',
  );
  assert.equal(
    immutableApplyDecision({ ...active, status: 'VOID', voidedAt: '2026-01-02' }, active),
    'conflict',
  );
  assert.equal(immutableApplyDecision(active, active), 'skip');
});

test('multi-cycle drain continues until empty and stops without progress', () => {
  assert.equal(PULL_MAX_PAGES, 500);
  assert.ok(SYNC_CYCLE_MAX_MS >= 8 * 60 * 1000);
  assert.equal(
    shouldContinueSyncLoop({
      startedAtMs: 0,
      nowMs: 1,
      round: 20,
      maxRounds: 500,
      madeProgress: true,
      exhausted: false,
    }),
    true,
  );
  assert.equal(
    shouldContinueSyncLoop({
      startedAtMs: 0,
      nowMs: 1,
      round: 20,
      maxRounds: 500,
      madeProgress: true,
      exhausted: true,
    }),
    false,
  );
  assert.equal(
    shouldContinueSyncLoop({
      startedAtMs: 0,
      nowMs: SYNC_CYCLE_MAX_MS,
      round: 1,
      maxRounds: 500,
      madeProgress: true,
      exhausted: false,
    }),
    false,
  );
});
