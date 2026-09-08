#!/usr/bin/env node
/**
 * Smoke test for offline online-activation licensing flow (sign, redeem lookup, verify).
 * Run: node release/scripts/test-offline-licensing.mjs
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync, createSign, createVerify, randomUUID } = crypto;

const root = path.resolve(__dirname, '../..');
const publicKeyPath = path.join(root, 'server/keys/license-public.pem');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

function signPayload(privateKey, payload) {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(payloadJson);
  signer.end();
  const signatureB64 = signer.sign(privateKey).toString('base64url');
  return { license: `${payloadB64}.${signatureB64}`, payloadJson };
}

function verifyLicense(publicKey, license) {
  const dot = license.lastIndexOf('.');
  const payloadJson = Buffer.from(license.slice(0, dot), 'base64url').toString('utf-8');
  const signature = Buffer.from(license.slice(dot + 1), 'base64url');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payloadJson);
  verifier.end();
  return verifier.verify(publicKey, signature);
}

function activationCodeLookup(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase(), 'utf8').digest('hex');
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const shippedPublic = fs.readFileSync(publicKeyPath, 'utf-8');

// Manual license path (existing flow)
const installationId = crypto.randomBytes(16).toString('hex');
const manualPayload = {
  product: 'DNT Dental',
  clinicId: 'TEST001',
  clinicName: 'Test Clinic',
  licenseId: randomUUID(),
  installationId,
  issuedAt: new Date().toISOString(),
  expiresAt: null,
};
const manual = signPayload(privateKey, manualPayload);
assert(verifyLicense(publicKeyPem, manual.license), 'manual license verifies with issuing public key');
assert(fs.existsSync(publicKeyPath), 'shipped license-public.pem exists for offline installs');

// Online activation code format
const activationCode = `DNT-${crypto.randomBytes(5).toString('hex').toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const lookup = activationCodeLookup(activationCode);
assert(lookup.length === 64, 'activation lookup is sha256 hex');
assert(activationCodeLookup(activationCode.toLowerCase()) === lookup, 'activation code lookup is case-insensitive');

// Redeemed online license uses same signed format
const onlinePayload = {
  product: 'DNT Dental',
  clinicId: 'TEST001',
  clinicName: 'Test Clinic Online',
  licenseId: randomUUID(),
  installationId,
  issuedAt: new Date().toISOString(),
  expiresAt: null,
};
const online = signPayload(privateKey, onlinePayload);
assert(verifyLicense(publicKeyPem, online.license), 'online-issued license verifies with public key');

console.log('PASS: offline licensing crypto smoke tests');
console.log('  installationId:', installationId);
console.log('  sample activation code:', activationCode);
console.log('  manual license length:', manual.license.length);
