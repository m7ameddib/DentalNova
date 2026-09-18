import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCensusProofPayload,
  isCompatibleSyncProtocol,
  isPairingSyncProtocol,
  parseSyncProtocolVersion,
  signCensusProof,
  SYNC_PROTOCOL_MIN_VERSION,
  SYNC_PROTOCOL_PAIRING_MIN_VERSION,
  SYNC_PROTOCOL_VERSION,
  verifyCensusProof,
} from './sync-protocol.util';
import { generateDeviceKeypair } from './device-trust.util';

const census = {
  patients: 0,
  payments: 0,
  treatments: 0,
  appointments: 0,
  total: 0,
};

test('sync protocol v3 is current; v2 remains compatible for existing devices', () => {
  assert.equal(SYNC_PROTOCOL_VERSION, 3);
  assert.equal(SYNC_PROTOCOL_MIN_VERSION, 2);
  assert.equal(SYNC_PROTOCOL_PAIRING_MIN_VERSION, 3);
  assert.equal(isCompatibleSyncProtocol(1), false);
  assert.equal(isCompatibleSyncProtocol(2), true);
  assert.equal(isCompatibleSyncProtocol(3), true);
  assert.equal(isCompatibleSyncProtocol(4), false);
  assert.equal(isPairingSyncProtocol(2), false);
  assert.equal(isPairingSyncProtocol(3), true);
  assert.equal(parseSyncProtocolVersion('3'), 3);
  assert.equal(parseSyncProtocolVersion(undefined), 0);
});

test('census HMAC is keyed by the pairing challenge and binds the device public key', () => {
  const keys = generateDeviceKeypair();
  const input = {
    protocolVersion: 3,
    challenge: 'abc123challenge-secret',
    installationId: 'inst-1',
    emptyClinic: true,
    census,
    devicePublicKey: keys.publicKey,
    licenseId: 'lic-1',
  };
  const proof = signCensusProof(input.challenge, input);
  assert.equal(verifyCensusProof(input.challenge, input, proof), true);
  assert.equal(verifyCensusProof('other-challenge', input, proof), false);
  assert.equal(verifyCensusProof(input.challenge, { ...input, challenge: 'other' }, proof), false);
  assert.equal(
    verifyCensusProof(input.challenge, { ...input, census: { ...census, patients: 1, total: 1 } }, proof),
    false,
  );
  const pairingCodeKeyed = signCensusProof('AB12CD34', input);
  assert.equal(verifyCensusProof(input.challenge, input, pairingCodeKeyed), false);
  const otherKey = generateDeviceKeypair();
  assert.equal(
    verifyCensusProof(input.challenge, { ...input, devicePublicKey: otherKey.publicKey }, proof),
    false,
  );
  const v2Shape = signCensusProof(input.challenge, { ...input, devicePublicKey: '', licenseId: '' });
  assert.equal(verifyCensusProof(input.challenge, input, v2Shape), false);
  const payload = JSON.parse(canonicalCensusProofPayload(input));
  assert.equal(payload.census.expenses, 0);
  assert.equal(payload.census.patients, 0);
  assert.equal(payload.emptyClinic, true);
  assert.equal(payload.devicePublicKey, keys.publicKey);
  assert.equal(payload.licenseId, 'lic-1');
});
