import test from 'node:test';
import assert from 'node:assert/strict';
import { isCachedSubscriptionUsable } from './subscription';

test('offline fallback does not treat missing cache as an active subscription', () => {
  assert.equal(isCachedSubscriptionUsable(null, { offline: true, graceMs: 1000 }), false);
});

test('uses last known expiry and blocks after grace', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const ok = isCachedSubscriptionUsable(
    { canUseSystem: true, expiresAt: '2026-09-14T11:00:00Z', status: 'ACTIVE' },
    { offline: true, graceMs: 48 * 3600 * 1000, now },
  );
  assert.equal(ok, true);
  const expired = isCachedSubscriptionUsable(
    { canUseSystem: true, expiresAt: '2026-09-01T11:00:00Z', status: 'ACTIVE' },
    { offline: true, graceMs: 48 * 3600 * 1000, now },
  );
  assert.equal(expired, false);
});
