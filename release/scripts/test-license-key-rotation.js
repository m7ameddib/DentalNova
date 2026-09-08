#!/usr/bin/env node
/**
 * License key rotation tests — ensures legacy and current production licenses verify.
 * Run: node release/scripts/test-license-key-rotation.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSign, createVerify, randomUUID } = crypto;

const root = path.resolve(__dirname, '../..');
const keysDir = path.join(root, 'server/keys');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

function loadPublicKeys() {
  const keys = [];
  const seen = new Set();
  const add = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const pem = fs.readFileSync(filePath, 'utf-8').trim();
    if (!pem || seen.has(pem)) return;
    seen.add(pem);
    keys.push(pem);
  };
  add(path.join(keysDir, 'license-public.pem'));
  add(path.join(keysDir, 'license-public-previous.pem'));
  for (const file of fs.readdirSync(keysDir)) {
    if (/^license-public-.+\.pem$/i.test(file)) {
      add(path.join(keysDir, file));
    }
  }
  return keys;
}

function signPayload(privateKeyPem, payload) {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(payloadJson);
  signer.end();
  return `${payloadB64}.${signer.sign(privateKeyPem).toString('base64url')}`;
}

function verifyWithAnyPublicKey(publicKeys, license) {
  const dot = license.lastIndexOf('.');
  const payloadJson = Buffer.from(license.slice(0, dot), 'base64url').toString('utf-8');
  const signature = Buffer.from(license.slice(dot + 1), 'base64url');
  return publicKeys.some((publicKey) => {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(payloadJson);
    verifier.end();
    return verifier.verify(publicKey, signature);
  });
}

const publicKeys = loadPublicKeys();
assert(publicKeys.length >= 2, 'expected current and legacy public keys in server/keys');

const installationId = crypto.randomBytes(16).toString('hex');
const basePayload = {
  product: 'DNT Dental',
  clinicId: 'ROTATION-TEST',
  clinicName: 'Rotation Test Clinic',
  licenseId: randomUUID(),
  installationId,
  issuedAt: new Date().toISOString(),
  expiresAt: null,
};

const legacyPrivatePath = path.join(root, 'tools/dibnova-license-generator/keys/license-private.pem');
if (fs.existsSync(legacyPrivatePath)) {
  const legacyLicense = signPayload(fs.readFileSync(legacyPrivatePath, 'utf-8'), {
    ...basePayload,
    clinicId: 'LEGACY-CUSTOMER',
  });
  assert(
    verifyWithAnyPublicKey(publicKeys, legacyLicense),
    'legacy customer license verifies against shipped public keys',
  );
  console.log('PASS: legacy customer license verification');
} else {
  console.log('SKIP: legacy private key not present (expected on CI)');
}

const productionPrivatePath = process.env.DNT_LICENSE_PRIVATE_KEY?.includes('BEGIN')
  ? null
  : process.env.DNT_LICENSE_PRIVATE_KEY ||
    'C:/Users/USER/DibNova/keys/license-private.pem';

if (productionPrivatePath && fs.existsSync(productionPrivatePath)) {
  const newLicense = signPayload(fs.readFileSync(productionPrivatePath, 'utf-8'), {
    ...basePayload,
    clinicId: 'NEW-CUSTOMER',
    licenseId: randomUUID(),
  });
  assert(
    verifyWithAnyPublicKey(publicKeys, newLicense),
    'new production license verifies against shipped public keys',
  );
  console.log('PASS: new production license verification');
} else {
  console.log('SKIP: production private key not present locally (expected on CI)');
}

// Always verify current + previous PEM files differ (rotation is active).
assert(
  fs.readFileSync(path.join(keysDir, 'license-public.pem'), 'utf8').trim() !==
    fs.readFileSync(path.join(keysDir, 'license-public-previous.pem'), 'utf8').trim(),
  'current and legacy public keys must differ',
);

console.log('PASS: license key rotation configuration');
