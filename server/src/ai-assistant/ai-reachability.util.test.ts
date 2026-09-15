import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_BUSY_MESSAGE,
  AI_PROVIDER_ERROR_MESSAGE,
  AI_TIMEOUT_MESSAGE,
  AI_TLS_MESSAGE,
  AI_UNAUTHORIZED_MESSAGE,
  AI_UNREACHABLE_MESSAGE,
  describeAiHttpStatus,
  describeAiReachabilityError,
  mapAiFetchFailure,
} from './ai-reachability.util';

test('timeout / abort map to AI timeout copy', () => {
  assert.equal(
    describeAiReachabilityError({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' }),
    AI_TIMEOUT_MESSAGE,
  );
  assert.equal(describeAiReachabilityError({ name: 'AbortError', message: 'aborted' }), AI_TIMEOUT_MESSAGE);
});

test('TLS and DNS/connection failures map to AI reachability copy', () => {
  assert.equal(describeAiReachabilityError({ message: 'unable to verify the first certificate' }), AI_TLS_MESSAGE);
  assert.equal(
    describeAiReachabilityError({ message: 'fetch failed', cause: { code: 'ENOTFOUND' } }),
    AI_UNREACHABLE_MESSAGE,
  );
});

test('Gemini/proxy HTTP statuses stay generic (no provider JSON)', () => {
  assert.equal(describeAiHttpStatus(401), AI_UNAUTHORIZED_MESSAGE);
  assert.equal(describeAiHttpStatus(403), AI_UNAUTHORIZED_MESSAGE);
  assert.equal(describeAiHttpStatus(429), AI_BUSY_MESSAGE);
  assert.equal(describeAiHttpStatus(500), AI_PROVIDER_ERROR_MESSAGE);
  assert.equal(describeAiHttpStatus(503), AI_PROVIDER_ERROR_MESSAGE);
});

test('mapAiFetchFailure covers undici fetch failed', () => {
  assert.equal(mapAiFetchFailure({ name: 'TypeError', message: 'fetch failed' }), AI_UNREACHABLE_MESSAGE);
  assert.equal(mapAiFetchFailure({ name: 'AbortError', message: 'This operation was aborted' }), AI_TIMEOUT_MESSAGE);
});
