import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCensusProofPayload,
  isCompatibleSyncProtocol,
  parseSyncProtocolVersion,
  signCensusProof,
  SYNC_PROTOCOL_MIN_VERSION,
  SYNC_PROTOCOL_VERSION,
  verifyCensusProof,
} from './sync-protocol.util';

const census = {
  patients: 0,
  payments: 0,
  treatments: 0,
  appointments: 0,
  total: 0,
};

test('sync protocol v2 is required', () => {
  assert.equal(SYNC_PROTOCOL_VERSION, 2);
  assert.equal(SYNC_PROTOCOL_MIN_VERSION, 2);
  assert.equal(isCompatibleSyncProtocol(1), false);
  assert.equal(isCompatibleSyncProtocol(2), true);
  assert.equal(isCompatibleSyncProtocol(3), false);
  assert.equal(parseSyncProtocolVersion('2'), 2);
  assert.equal(parseSyncProtocolVersion(undefined), 0);
});

test('census HMAC is keyed by the pairing challenge, not the short pairing code', () => {
  const input = {
    protocolVersion: 2,
    challenge: 'abc123challenge-secret',
    installationId: 'inst-1',
    emptyClinic: true,
    census,
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
  const payload = JSON.parse(canonicalCensusProofPayload(input));
  assert.equal(payload.census.expenses, 0);
  assert.equal(payload.census.patients, 0);
  assert.equal(payload.emptyClinic, true);
});
