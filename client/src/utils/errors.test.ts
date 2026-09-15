import test from 'node:test';
import assert from 'node:assert/strict';
import { getApiErrorCode, getErrorMessage } from './errors';

test('getErrorMessage reads string and array Nest messages', () => {
  const stringErr = {
    isAxiosError: true,
    response: { data: { message: 'This Offline installation already has clinic records' } },
  };
  const arrayErr = {
    isAxiosError: true,
    response: { data: { message: ['onlineUrl must be a string', 'pairingCode must be longer'] } },
  };
  const empty = { isAxiosError: true, response: { data: { error: 'Bad Request' } } };
  assert.equal(
    getErrorMessage(stringErr, 'fallback'),
    'This Offline installation already has clinic records',
  );
  assert.match(getErrorMessage(arrayErr, 'fallback'), /onlineUrl/);
  assert.equal(getErrorMessage(empty, 'fallback'), 'fallback');
  assert.equal(getErrorMessage(new Error('nope'), 'fallback'), 'fallback');
});

test('opaque Unexpected server error uses the fallback instead of the 500 string', () => {
  const err = {
    isAxiosError: true,
    response: { data: { message: 'Unexpected server error' } },
  };
  assert.equal(
    getErrorMessage(err, 'Check the Online address and pairing code.'),
    'Check the Online address and pairing code.',
  );
});

test('axios timeout and network errors are user-facing', () => {
  assert.match(
    getErrorMessage({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 8000ms exceeded' }, 'fallback'),
    /timed out/i,
  );
  assert.match(
    getErrorMessage({ isAxiosError: true, message: 'Network Error' }, 'fallback'),
    /Could not reach the clinic server/,
  );
});

test('getApiErrorCode reads Nest machine codes', () => {
  const err = {
    isAxiosError: true,
    response: { data: { code: 'POPULATED_OFFLINE_BLOCKED', message: 'blocked' } },
  };
  assert.equal(getApiErrorCode(err), 'POPULATED_OFFLINE_BLOCKED');
  assert.equal(getApiErrorCode(new Error('nope')), undefined);
});
