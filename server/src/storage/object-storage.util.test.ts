import test from 'node:test';
import assert from 'node:assert/strict';
import { r2ObjectKey, withRetries } from './object-storage.util';

test('R2 keys are clinic-namespaced and never expose a sibling clinic prefix', () => {
  const a = r2ObjectKey('patients/1/x.png', 'clinic-a');
  const b = r2ObjectKey('patients/1/x.png', 'clinic-b');
  assert.equal(a.startsWith('clinic-a/'), true);
  assert.equal(b.startsWith('clinic-b/'), true);
  assert.notEqual(a, b);
});

test('optional prefix is applied in front of the clinic id', () => {
  assert.equal(r2ObjectKey('a.pdf', 'c1', 'prod'), 'prod/c1/a.pdf');
});

test('withRetries returns on first success and retries failures', async () => {
  let n = 0;
  const value = await withRetries(async () => {
    n += 1;
    if (n < 2) throw new Error('fail');
    return 7;
  }, 3, 1);
  assert.equal(value, 7);
  assert.equal(n, 2);
});
