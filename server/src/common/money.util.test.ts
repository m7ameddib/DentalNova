import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingCents, creditCents, accountBalance, amountToCents, centsToAmount } from './money.util';

test('amountToCents uses decimal-safe rounding instead of IEEE amount * 100', () => {
  assert.equal(amountToCents(19.99), 1999);
  assert.equal(amountToCents(1.005), 101);
  assert.equal(amountToCents(2.675), 268);
  assert.equal(amountToCents(0.1 + 0.2), 30);
  assert.equal(amountToCents(35.85), 3585);
  assert.equal(centsToAmount(1999), 19.99);
  for (let i = 0; i <= 10_000; i += 1) {
    assert.equal(amountToCents(i / 100), i, `cents ${i}`);
  }
});

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

test('creditCents exposes overpayment without changing remainingCents', () => {
  assert.equal(creditCents(10_000, 15_000), 5_000);
  assert.equal(creditCents(10_000, 4_000), 0);
  const both = accountBalance(8_000, 11_000);
  assert.equal(both.remainingCents, 0);
  assert.equal(both.creditCents, 3_000);
});
