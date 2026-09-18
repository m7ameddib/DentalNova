import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPairingPayload,
  compactPairingCode,
  formatPairingCodeDisplay,
  INVALID_ONLINE_URL,
  normalizeOnlineBaseUrl,
  payloadContainsDeviceSecret,
  publicPeerInfo,
  toPublicPeerInfo,
} from './pairing-public.util';

const stored = {
  deviceId: 'dev-1',
  deviceSecret: 'super-secret-device-credential',
  onlineBaseUrl: 'https://dentalnova.dibnova.com',
  onlineClinicId: 'clinic-1',
  clinicName: 'Main Clinic',
  pairedAt: '2026-09-14T00:00:00.000Z',
  devicePrivateKey: 'super-secret-device-private-key',
  devicePublicKey: 'device-public-key-spki',
};

test('public peer info never includes deviceSecret or secretHash', () => {
  const publicInfo = publicPeerInfo(stored);
  assert.equal(publicInfo.deviceId, 'dev-1');
  assert.equal(publicInfo.clinicId, 'clinic-1');
  assert.equal(publicInfo.clinicName, 'Main Clinic');
  assert.equal(publicInfo.onlineBaseUrl, 'https://dentalnova.dibnova.com');
  assert.equal(publicInfo.paired, true);
  assert.equal(payloadContainsDeviceSecret(publicInfo), false);
  assert.equal('deviceSecret' in publicInfo, false);
  assert.equal('secretHash' in publicInfo, false);
  assert.equal('devicePrivateKey' in publicInfo, false);
  assert.equal('devicePublicKey' in publicInfo, false);
  assert.equal(JSON.stringify(publicInfo).includes('super-secret'), false);
});

test('toPublicPeerInfo matches publicPeerInfo and strips secrets', () => {
  const publicPeer = toPublicPeerInfo(stored);
  assert.deepEqual(publicPeer, publicPeerInfo(stored));
  assert.equal('deviceSecret' in publicPeer, false);
});

test('secret detector flags nested deviceSecret keys', () => {
  assert.equal(payloadContainsDeviceSecret({ deviceSecret: 'abc' }), true);
  assert.equal(payloadContainsDeviceSecret({ nested: { secretHash: 'x' } }), true);
  assert.equal(payloadContainsDeviceSecret({ devicePrivateKey: 'pkcs8' }), true);
  assert.equal(payloadContainsDeviceSecret({ clinicName: 'A', deviceId: 'd' }), false);
});

test('normalizeOnlineBaseUrl keeps http(s) origin and rejects credentials', () => {
  assert.equal(normalizeOnlineBaseUrl('https://dentalnova.dibnova.com/setup'), 'https://dentalnova.dibnova.com');
  assert.equal(normalizeOnlineBaseUrl('http://127.0.0.1:4000/'), 'http://127.0.0.1:4000');
  assert.equal(normalizeOnlineBaseUrl('http://localhost:4000/'), 'http://localhost:4000');
  assert.throws(() => normalizeOnlineBaseUrl('http://evil.example.com'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('http://192.168.1.9:4000'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('file:///etc/passwd'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('ftp://example.com'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('https://user:secret@example.com'), (err: Error) => err.message === INVALID_ONLINE_URL);
  assert.throws(() => normalizeOnlineBaseUrl('not a url'), (err: Error) => err.message === INVALID_ONLINE_URL);
});

test('pairing payload is compact code + URL only', () => {
  assert.equal(compactPairingCode('ab cd-efgh'), 'ABCDEFGH');
  assert.equal(formatPairingCodeDisplay('abcdefgh'), 'ABCD-EFGH');
  assert.equal(
    buildPairingPayload('https://dentalnova.dibnova.com/', 'ab-cd2345'),
    'DNPAIR1|https://dentalnova.dibnova.com|ABCD2345',
  );
});
