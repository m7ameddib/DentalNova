import test from 'node:test';
import assert from 'node:assert/strict';
import { payloadContainsDeviceSecret, publicPeerInfo, normalizeOnlineBaseUrl } from './pairing-public.util';

test('public peer info never includes deviceSecret or secretHash', () => {
  const publicInfo = publicPeerInfo({
    deviceId: 'dev-1',
    deviceSecret: 'super-secret-device-credential',
    onlineBaseUrl: 'https://dentalnova.dibnova.com',
    onlineClinicId: 'clinic-1',
    clinicName: 'Main Clinic',
    pairedAt: '2026-09-14T00:00:00.000Z',
  });
  assert.equal(publicInfo.deviceId, 'dev-1');
  assert.equal(publicInfo.clinicId, 'clinic-1');
  assert.equal(publicInfo.clinicName, 'Main Clinic');
  assert.equal(publicInfo.onlineUrl, 'https://dentalnova.dibnova.com');
  assert.equal(payloadContainsDeviceSecret(publicInfo), false);
  assert.equal('deviceSecret' in publicInfo, false);
  assert.equal('secretHash' in publicInfo, false);
});

test('secret detector flags nested deviceSecret keys', () => {
  assert.equal(payloadContainsDeviceSecret({ deviceSecret: 'abc' }), true);
  assert.equal(payloadContainsDeviceSecret({ nested: { secretHash: 'x' } }), true);
  assert.equal(payloadContainsDeviceSecret({ clinicName: 'A', deviceId: 'd' }), false);
});

test('Online URL must be http(s) origin without credentials in the path', () => {
  assert.equal(normalizeOnlineBaseUrl('https://dentalnova.dibnova.com/setup'), 'https://dentalnova.dibnova.com');
  assert.equal(normalizeOnlineBaseUrl('http://127.0.0.1:4000/'), 'http://127.0.0.1:4000');
  assert.throws(() => normalizeOnlineBaseUrl('file:///etc/passwd'), /http/);
  assert.throws(() => normalizeOnlineBaseUrl('not a url'), /valid Online address/);
});
