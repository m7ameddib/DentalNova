import test from 'node:test';
import assert from 'node:assert/strict';
import { isObjectNotFoundError, keepLocalCopyAfterRemoteFailure, partialReceivedHighWater, r2ObjectKey, withRetries } from './object-storage.util';

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

test('missing R2 objects are not treated as storage outages', () => {
  assert.equal(isObjectNotFoundError({ name: 'NoSuchKey' }), true);
  assert.equal(isObjectNotFoundError({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isObjectNotFoundError({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }), false);
});

test('withRetries does not retry non-retryable errors', async () => {
  let n = 0;
  await assert.rejects(
    () =>
      withRetries(
        async () => {
          n += 1;
          throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
        },
        3,
        1,
        (err) => !isObjectNotFoundError(err),
      ),
    /missing/,
  );
  assert.equal(n, 1);
});

test('partial received uses a high-water mark so retried chunks do not double-count', () => {
  assert.equal(partialReceivedHighWater(0, 0, 256), 256);
  assert.equal(partialReceivedHighWater(256, 0, 256), 256);
  assert.equal(partialReceivedHighWater(256, 256, 256), 512);
});

test('Online R2 put failure must not keep a local orphan copy', () => {
  assert.equal(keepLocalCopyAfterRemoteFailure(true), false);
  assert.equal(keepLocalCopyAfterRemoteFailure(false), true);
});
