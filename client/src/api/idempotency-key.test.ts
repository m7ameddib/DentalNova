import test from 'node:test';
import assert from 'node:assert/strict';
import { idempotencyKeyFor } from './idempotency-key';

test('GET requests do not get an idempotency key', () => {
  assert.equal(idempotencyKeyFor('GET', '/patients', undefined), undefined);
});

test('identical POSTs within the window share a key; different bodies do not', () => {
  const a = idempotencyKeyFor('POST', '/payments', { patientId: 1, amount: 10 });
  const b = idempotencyKeyFor('POST', '/payments', { patientId: 1, amount: 10 });
  const c = idempotencyKeyFor('POST', '/payments', { patientId: 1, amount: 20 });
  assert.ok(a);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
