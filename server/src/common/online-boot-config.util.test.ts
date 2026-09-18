import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSING_PLATFORM_SECRETS_BOOT_ERROR,
  REUSED_PLATFORM_SECRETS_BOOT_ERROR,
  WEAK_JWT_SECRET_BOOT_ERROR,
  onlineBootConfigError,
} from './online-boot-config.util';

const STRONG = 'online-boot-test-jwt-secret-value-32ch';

test('short or placeholder JWT_SECRET fails online boot', () => {
  assert.equal(onlineBootConfigError({ jwtSecret: 'password', isProduction: false }), WEAK_JWT_SECRET_BOOT_ERROR);
  assert.equal(onlineBootConfigError({ jwtSecret: 'dev-secret', isProduction: false }), WEAK_JWT_SECRET_BOOT_ERROR);
  assert.equal(onlineBootConfigError({ jwtSecret: STRONG, isProduction: false }), null);
});

test('production requires a platform secrets key distinct from JWT_SECRET', () => {
  const base = {
    jwtSecret: STRONG,
    isProduction: true,
    adminUsername: 'admin',
    adminPassword: 'admin-pass',
  };
  assert.equal(onlineBootConfigError({ ...base, platformSecretsKey: '' }), MISSING_PLATFORM_SECRETS_BOOT_ERROR);
  assert.equal(
    onlineBootConfigError({ ...base, platformSecretsKey: STRONG }),
    REUSED_PLATFORM_SECRETS_BOOT_ERROR,
  );
  assert.equal(onlineBootConfigError({ ...base, platformSecretsKey: `${STRONG}-other` }), null);
});
