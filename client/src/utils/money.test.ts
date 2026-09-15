import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingAfterUnreflectedPayment } from './money';

test('receipt remaining subtracts a payment that is not in the summary yet', () => {
  assert.equal(remainingAfterUnreflectedPayment(5000, 2000), 3000);
  assert.equal(remainingAfterUnreflectedPayment(1500, 2000), 0);
  assert.equal(remainingAfterUnreflectedPayment(undefined, 500), 0);
});
