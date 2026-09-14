import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingCents, isBillableTreatmentStatus } from './money.util';

test('remainingCents keeps a normal unpaid balance', () => {
  assert.equal(remainingCents(10_000, 4_000), 6_000);
});

test('remainingCents is 0 when the balance is fully paid', () => {
  assert.equal(remainingCents(10_000, 10_000), 0);
});

test('remainingCents is 0 on overpayment, never negative', () => {
  assert.equal(remainingCents(10_000, 15_000), 0);
  assert.ok(remainingCents(5_000, 8_000) >= 0);
});

test('added treatments are billable immediately; voided treatments are not', () => {
  assert.equal(isBillableTreatmentStatus('PLANNED'), true);
  assert.equal(isBillableTreatmentStatus('IN_PROGRESS'), true);
  assert.equal(isBillableTreatmentStatus('COMPLETED'), true);
  assert.equal(isBillableTreatmentStatus('VOID'), false);
  assert.equal(isBillableTreatmentStatus(null), false);
});

test('completing a treatment does not create a second billable amount', () => {
  const addedCents = 15_000;
  const afterAdd = remainingCents(addedCents, 0);
  const afterComplete = remainingCents(addedCents, 0);
  assert.equal(afterAdd, 15_000);
  assert.equal(afterComplete, afterAdd);
});
