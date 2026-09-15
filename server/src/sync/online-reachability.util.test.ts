import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeOnlineReachabilityError,
  friendlyStoredSyncError,
  GENERIC_UNEXPECTED_MESSAGE,
  messageFromOnlineResponse,
  ONLINE_NOT_FOUND_MESSAGE,
  ONLINE_SERVER_ERROR_MESSAGE,
  ONLINE_TIMEOUT_MESSAGE,
  ONLINE_TLS_MESSAGE,
  ONLINE_UNAUTHORIZED_MESSAGE,
  ONLINE_UNREACHABLE_MESSAGE,
} from './online-reachability.util';

test('timeout / abort map to a user-facing Online timeout message', () => {
  assert.equal(describeOnlineReachabilityError({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' }), ONLINE_TIMEOUT_MESSAGE);
  assert.equal(describeOnlineReachabilityError({ name: 'AbortError', message: 'aborted' }), ONLINE_TIMEOUT_MESSAGE);
});

test('TLS and DNS/connection failures map to clear Online reachability copy', () => {
  assert.equal(describeOnlineReachabilityError({ message: 'unable to verify the first certificate' }), ONLINE_TLS_MESSAGE);
  assert.equal(describeOnlineReachabilityError({ message: 'fetch failed', cause: { code: 'ENOTFOUND' } }), ONLINE_UNREACHABLE_MESSAGE);
  assert.equal(describeOnlineReachabilityError({ message: 'fetch failed', cause: { code: 'ECONNREFUSED' } }), ONLINE_UNREACHABLE_MESSAGE);
});

test('Online 500 Unexpected server error is not forwarded verbatim', () => {
  assert.equal(
    messageFromOnlineResponse(500, { message: GENERIC_UNEXPECTED_MESSAGE }, 'fallback'),
    ONLINE_SERVER_ERROR_MESSAGE,
  );
  assert.equal(
    messageFromOnlineResponse(401, { message: 'Invalid or expired pairing code.' }, 'fallback'),
    'Invalid or expired pairing code.',
  );
  assert.equal(messageFromOnlineResponse(404, {}, 'fallback'), ONLINE_NOT_FOUND_MESSAGE);
  assert.equal(messageFromOnlineResponse(401, {}, 'fallback'), ONLINE_UNAUTHORIZED_MESSAGE);
});

test('legacy last_error codes become user-facing status text', () => {
  assert.equal(friendlyStoredSyncError(''), null);
  assert.equal(friendlyStoredSyncError(GENERIC_UNEXPECTED_MESSAGE), ONLINE_SERVER_ERROR_MESSAGE);
  assert.match(friendlyStoredSyncError('not-paired') || '', /not paired/);
  assert.equal(friendlyStoredSyncError('push-failed-500'), ONLINE_SERVER_ERROR_MESSAGE);
  assert.equal(friendlyStoredSyncError('snapshot-failed-404'), ONLINE_NOT_FOUND_MESSAGE);
  assert.equal(friendlyStoredSyncError('Could not reach the Online clinic.'), 'Could not reach the Online clinic.');
});
