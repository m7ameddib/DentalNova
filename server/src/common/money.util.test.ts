import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingCents } from './money.util';

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
