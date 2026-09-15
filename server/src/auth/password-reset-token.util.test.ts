import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordResetTag, passwordResetTagMatches } from './password-reset-token.util';

test('password reset tags match the current hash and fail after it changes', () => {
  const tag = passwordResetTag('hash-v1');
  assert.equal(passwordResetTagMatches('hash-v1', tag), true);
  assert.equal(passwordResetTagMatches('hash-v2', tag), false);
  assert.equal(passwordResetTagMatches('hash-v1', undefined), false);
  assert.equal(passwordResetTagMatches('hash-v1', ''), false);
});
