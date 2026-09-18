import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalDeviceRequestPayload,
  canonicalPairingTranscript,
  deviceTimestampFresh,
  DEVICE_REQUEST_MAX_SKEW_MS,
  deviceTrustHeaders,
  generateDeviceKeypair,
  isDevicePublicKeyFormat,
  signWithDeviceKey,
  verifyDeviceRequestSignature,
  verifyDeviceSignature,
} from './device-trust.util';

const emptyCensus = {
  patients: 0,
  payments: 0,
  treatments: 0,
  appointments: 0,
  total: 0,
};

test('Ed25519 device keypair signs and verifies pairing transcripts', () => {
  const keys = generateDeviceKeypair();
  assert.equal(isDevicePublicKeyFormat(keys.publicKey), true);
  assert.equal(isDevicePublicKeyFormat('not-a-key'), false);
  const transcript = canonicalPairingTranscript({
    protocolVersion: 3,
    challenge: 'challenge-1',
    installationId: 'inst-1',
    licenseId: 'lic-1',
    devicePublicKey: keys.publicKey,
    emptyClinic: true,
    census: emptyCensus,
  });
  const signature = signWithDeviceKey(keys.privateKey, transcript);
  assert.equal(verifyDeviceSignature(keys.publicKey, transcript, signature), true);
  const other = generateDeviceKeypair();
  assert.equal(verifyDeviceSignature(other.publicKey, transcript, signature), false);
  const forged = canonicalPairingTranscript({
    protocolVersion: 3,
    challenge: 'challenge-1',
    installationId: 'inst-1',
    licenseId: 'lic-1',
    devicePublicKey: keys.publicKey,
    emptyClinic: true,
    census: { ...emptyCensus, patients: 1, total: 1 },
  });
  assert.equal(verifyDeviceSignature(keys.publicKey, forged, signature), false);
});

test('a custom client key cannot satisfy a different registered device public key', () => {
  const official = generateDeviceKeypair();
  const custom = generateDeviceKeypair();
  const payload = canonicalDeviceRequestPayload({
    timestamp: '1000',
    method: 'POST',
    path: '/api/sync/push',
    bodySha256: 'abc',
  });
  const customSig = signWithDeviceKey(custom.privateKey, payload);
  assert.equal(verifyDeviceSignature(official.publicKey, payload, customSig), false);
  assert.equal(verifyDeviceSignature(custom.publicKey, payload, customSig), true);
});

test('device request signatures bind method, path, body hash, and timestamp', () => {
  const keys = generateDeviceKeypair();
  const now = 1_700_000_000_000;
  const body = JSON.stringify({ changes: [] });
  const headers = deviceTrustHeaders(keys.privateKey, 'POST', '/api/sync/push', body, now);
  assert.equal(
    verifyDeviceRequestSignature({
      publicKey: keys.publicKey,
      method: 'POST',
      path: '/api/sync/push',
      body,
      timestamp: headers['x-dentalnova-device-ts'],
      signature: headers['x-dentalnova-device-sig'],
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    verifyDeviceRequestSignature({
      publicKey: keys.publicKey,
      method: 'POST',
      path: '/api/sync/push',
      body: JSON.stringify({ changes: [{ injected: true }] }),
      timestamp: headers['x-dentalnova-device-ts'],
      signature: headers['x-dentalnova-device-sig'],
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    verifyDeviceRequestSignature({
      publicKey: keys.publicKey,
      method: 'GET',
      path: '/api/sync/push',
      body,
      timestamp: headers['x-dentalnova-device-ts'],
      signature: headers['x-dentalnova-device-sig'],
      nowMs: now,
    }),
    false,
  );
});

test('stale or future device timestamps are rejected', () => {
  const now = 1_700_000_000_000;
  assert.equal(deviceTimestampFresh(now, now), true);
  assert.equal(deviceTimestampFresh(now - DEVICE_REQUEST_MAX_SKEW_MS - 1, now), false);
  assert.equal(deviceTimestampFresh(now + DEVICE_REQUEST_MAX_SKEW_MS + 1, now), false);
  assert.equal(deviceTimestampFresh('nope', now), false);
});
