import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonBytes, PUSH_BATCH_MAX_JSON_BYTES, pushRoundFollowUp, splitPushBatch } from './push-batch.util';
import { SyncChangePayload } from './sync.entities';

function change(i: number, padding = ''): SyncChangePayload {
  return {
    changeId: `c-${i}`,
    entity: 'treatment_types',
    recordUid: `uid-${i}`,
    op: 'upsert',
    row: { name: `Type ${i}${padding}` },
  };
}

test('splitPushBatch respects item cap so 121 pending rows are sent in chunks', () => {
  const pending = Array.from({ length: 121 }, (_, i) => change(i));
  const first = splitPushBatch(pending, 40);
  const second = splitPushBatch(pending.slice(40), 40);
  const third = splitPushBatch(pending.slice(80), 40);
  const fourth = splitPushBatch(pending.slice(120), 40);
  assert.equal(first.length, 40);
  assert.equal(second.length, 40);
  assert.equal(third.length, 40);
  assert.equal(fourth.length, 1);
  assert.equal(first.length + second.length + third.length + fourth.length, 121);
});

test('splitPushBatch stays under the JSON byte budget', () => {
  const fat = change(1, 'x'.repeat(20_000));
  const pending = [fat, fat, fat];
  const batch = splitPushBatch(pending, 40, 30_000);
  assert.equal(batch.length, 1);
  assert.ok(jsonBytes({ changes: batch }) <= PUSH_BATCH_MAX_JSON_BYTES || batch.length === 1);
});

test('a single oversized row is still returned so Online can reject it clearly', () => {
  const huge = change(1, 'y'.repeat(90_000));
  const batch = splitPushBatch([huge], 40, 1_000);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].changeId, 'c-1');
});

test('push round parks UNIQUE conflicts instead of aborting the cycle', () => {
  const follow = pushRoundFollowUp({
    batchIds: ['type-1', 'type-2', 'patient-1'],
    accepted: [],
    skipped: [],
  });
  assert.deepEqual(follow.acked, []);
  assert.deepEqual(follow.skipThisCycle, ['type-1', 'type-2', 'patient-1']);
  const next = pushRoundFollowUp({
    batchIds: ['patient-1', 'pay-1'],
    accepted: ['patient-1'],
    skipped: [],
  });
  assert.deepEqual(next.acked, ['patient-1']);
  assert.deepEqual(next.skipThisCycle, ['pay-1']);
});
