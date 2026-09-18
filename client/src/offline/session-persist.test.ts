import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSessionPersistTarget } from './session-persist';

test('session-only logins stay in sessionStorage after fallback', () => {
  assert.equal(chooseSessionPersistTarget({ localHasToken: false, sessionHasToken: true }), 'session');
});

test('remember-me logins keep using localStorage', () => {
  assert.equal(chooseSessionPersistTarget({ localHasToken: true, sessionHasToken: false }), 'local');
});

test('does not invent a storage target when neither store has the token', () => {
  assert.equal(chooseSessionPersistTarget({ localHasToken: false, sessionHasToken: false }), null);
});
