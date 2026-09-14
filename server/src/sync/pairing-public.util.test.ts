import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPairingPayload,
  compactPairingCode,
  formatPairingCodeDisplay,
  INVALID_ONLINE_URL,
  normalizeOnlineBaseUrl,
  toPublicPeerInfo,
} from './pairing-public.util';

test('normalizeOnlineBaseUrl keeps http(s) origin and rejects credentials', () => {
  assert.equal(normalizeOnlineBaseUrl('https://dentalnova.dibnova.com/'), 'https://dentalnova.dibnova.com');
  assert.equal(normalizeOnlineBaseUrl('http://192.168.1.10:3000/app'), 'http://192.168.1.10:3000');
  assert.throws(() => normalizeOnlineBaseUrl('ftp://example.com'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('https://user:secret@example.com'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('not a url'), (err: Error) => err.message === INVALID_ONLINE_URL);
});

test('toPublicPeerInfo never includes the device secret', () => {
  const publicPeer = toPublicPeerInfo({
    deviceId: 'dev-1',
    deviceSecret: 'super-secret-value',
    onlineBaseUrl: 'https://dentalnova.dibnova.com',
    onlineClinicId: 'clinic-1',
    clinicName: 'Sunrise Dental',
    pairedAt: '2026-09-14T00:00:00.000Z',
  });
  assert.equal(publicPeer.clinicName, 'Sunrise Dental');
  assert.equal(publicPeer.clinicId, 'clinic-1');
  assert.equal(publicPeer.deviceId, 'dev-1');
  assert.equal('deviceSecret' in publicPeer, false);
  assert.equal(JSON.stringify(publicPeer).includes('super-secret-value'), false);
});

test('pairing payload is compact code + URL only', () => {
  assert.equal(compactPairingCode('ab cd-efgh'), 'ABCDEFGH');
  assert.equal(formatPairingCodeDisplay('abcdefgh'), 'ABCD-EFGH');
  assert.equal(buildPairingPayload('https://dentalnova.dibnova.com/', 'ab-cd2345'), 'DNPAIR1|https://dentalnova.dibnova.com|ABCD2345');
});
