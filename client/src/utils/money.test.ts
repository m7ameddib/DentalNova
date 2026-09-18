import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingAfterUnreflectedPayment, amountToCents } from './money';

test('receipt remaining subtracts a payment that is not in the summary yet', () => {
  assert.equal(remainingAfterUnreflectedPayment(5000, 2000), 3000);
  assert.equal(remainingAfterUnreflectedPayment(1500, 2000), 0);
  assert.equal(remainingAfterUnreflectedPayment(undefined, 500), 0);
});

test('amountToCents rounds decimal-safe 2-place currency', () => {
  assert.equal(amountToCents(19.99), 1999);
  assert.equal(amountToCents(1.005), 101);
  assert.equal(amountToCents(0.1 + 0.2), 30);
});

test('receipt remaining subtracts a payment that is not in the summary yet', () => {
  assert.equal(remainingAfterUnreflectedPayment(5000, 2000), 3000);
  assert.equal(remainingAfterUnreflectedPayment(1500, 2000), 0);
  assert.equal(remainingAfterUnreflectedPayment(undefined, 500), 0);
});
