import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPairingPayload,
  compactPairingCode,
  formatCountdown,
  formatPairingCodeDisplay,
  pairingSecondsLeft,
} from './pairing-payload';

test('pairing codes ignore dashes and stay uppercase', () => {
  assert.equal(compactPairingCode('ab-cd 23 45'), 'ABCD2345');
  assert.equal(formatPairingCodeDisplay('abcd2345'), 'ABCD-2345');
});

test('pairing payload never invents a secret', () => {
  const payload = buildPairingPayload('https://dentalnova.dibnova.com/', 'zx9k2m4p');
  assert.equal(payload, 'DNPAIR1|https://dentalnova.dibnova.com|ZX9K2M4P');
  assert.equal(payload.includes('secret'), false);
});

test('countdown formats remaining pairing time', () => {
  assert.equal(formatCountdown(125), '2:05');
  assert.equal(formatCountdown(0), '0:00');
  const expires = new Date(1_000_000).toISOString();
  assert.equal(pairingSecondsLeft(expires, 1_000_000 - 4500), 4);
  assert.equal(pairingSecondsLeft(expires, 1_000_000 + 100), 0);
});
