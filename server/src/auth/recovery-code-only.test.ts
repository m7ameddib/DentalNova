import test from 'node:test';
import assert from 'node:assert/strict';
import { SMS_NOT_CONFIGURED } from './sms.service';
import { RECOVERY_CODE_ONLY } from './password-reset.service';

test('SMS and OTP password reset are disabled in favor of recovery codes', () => {
  assert.match(SMS_NOT_CONFIGURED, /recovery code/i);
  assert.match(RECOVERY_CODE_ONLY, /recovery code/i);
  assert.match(RECOVERY_CODE_ONLY, /not available/i);
});
