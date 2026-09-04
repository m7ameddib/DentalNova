#!/usr/bin/env node
/**
 * DibNova Technologies — DNT Dental License Generator
 * KEEP PRIVATE. Do NOT ship this tool or the private key to clinics.
 *
 * Usage:
 *   node generate-license.js --clinic-id CLINIC001 --clinic-name "My Clinic" --installation-id <from activation screen> [--expires 2027-12-31]
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    out[key] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv);
const clinicId = args['clinic-id'];
const clinicName = args['clinic-name'];
const installationId = args['installation-id'];
if (!clinicId || !clinicName) {
  console.error('Required: --clinic-id and --clinic-name');
  process.exit(1);
}
if (!installationId?.trim()) {
  console.error('Required: --installation-id (copy from DNT Dental activation screen on the clinic PC)');
  process.exit(1);
}

const privateKeyPath = process.env.DNT_LICENSE_PRIVATE_KEY
  || path.join(__dirname, 'keys', 'license-private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('Missing private key at', privateKeyPath);
  process.exit(1);
}
const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

const payload = {
  product: 'DNT Dental',
  clinicId,
  clinicName,
  licenseId: crypto.randomUUID(),
  installationId: installationId.trim(),
  issuedAt: new Date().toISOString(),
  expiresAt: args.expires ? new Date(args.expires).toISOString() : null,
};

const payloadJson = JSON.stringify(payload);
const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
const signer = crypto.createSign('RSA-SHA256');
signer.update(payloadJson);
signer.end();
const signatureB64 = signer.sign(privateKey).toString('base64url');
const license = `${payloadB64}.${signatureB64}`;

const outFile = path.join(__dirname, 'output', `${clinicId}.dntlic`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, license, 'utf-8');

console.log('License generated:', outFile);
console.log('License ID:', payload.licenseId);
console.log('\n--- License (paste into DNT Dental activation) ---\n');
console.log(license);
