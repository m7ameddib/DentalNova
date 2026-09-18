/**
 * Security + clinic sync integration tests (Online).
 * Requires server/dist/main.js (npm run build:server).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const MAIN = path.join(ROOT, 'server', 'dist', 'main.js');
const PORT = process.env.SECURITY_SYNC_TEST_PORT || '4109';
const BASE = `http://127.0.0.1:${PORT}/api`;
const JWT_SECRET = 'security-sync-test-jwt-secret-value-32ch';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, urlPath, { token, body, expected, headers, protocol } = {}) {
  const hdrs = { Accept: 'application/json', ...(headers || {}) };
  if (protocol !== false) {
    hdrs['x-dentalnova-sync-protocol'] = String(protocol == null ? 3 : protocol);
  }
  if (body !== undefined) hdrs['Content-Type'] = 'application/json';
  if (token) hdrs.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: hdrs,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (expected && res.status !== expected && !(Array.isArray(expected) && expected.includes(res.status))) {
    throw new Error(`${method} ${urlPath} expected ${expected}, got ${res.status}: ${text}`);
  }
  return { status: res.status, data };
}

async function collectSnapshot(token, privateKey) {
  const all = [];
  let afterEntity;
  let afterId;
  for (let i = 0; i < 40; i += 1) {
    const qs = new URLSearchParams({ limit: '80' });
    if (afterEntity) qs.set('afterEntity', afterEntity);
    if (afterId != null) qs.set('afterId', String(afterId));
    const urlPath = `/sync/snapshot?${qs.toString()}`;
    const snap = await request('GET', urlPath, {
      token,
      expected: 200,
      headers: privateKey
        ? deviceTrustHeaders(privateKey, 'GET', `/api${urlPath}`, '')
        : undefined,
    });
    const batch = snap.data.changes || [];
    all.push(...batch);
    if (!snap.data.hasMore) break;
    afterEntity = snap.data.nextAfterEntity;
    afterId = snap.data.nextAfterId;
    if (!afterEntity && !afterId) break;
  }
  return all;
}

function compactPairingCode(raw) {
  return String(raw || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function signCensusProof(hmacSecret, input) {
  const census = {
    appointments: Number(input.census.appointments) || 0,
    expenses: Number(input.census.expenses) || 0,
    labCases: Number(input.census.labCases) || 0,
    notes: Number(input.census.notes) || 0,
    patients: Number(input.census.patients) || 0,
    payments: Number(input.census.payments) || 0,
    prescriptions: Number(input.census.prescriptions) || 0,
    total: Number(input.census.total) || 0,
    treatments: Number(input.census.treatments) || 0,
  };
  const payload = JSON.stringify({
    census,
    challenge: String(input.challenge || ''),
    devicePublicKey: String(input.devicePublicKey || ''),
    emptyClinic: input.emptyClinic === true,
    installationId: String(input.installationId || ''),
    licenseId: String(input.licenseId || ''),
    protocolVersion: Number(input.protocolVersion) || 0,
  });
  return crypto.createHmac('sha256', String(hmacSecret || '')).update(payload).digest('hex');
}

function generateDeviceKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64url'),
  };
}

function signWithDeviceKey(privateKeyB64, payload) {
  const key = crypto.createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64url'),
    type: 'pkcs8',
    format: 'der',
  });
  return crypto.sign(null, Buffer.from(payload, 'utf8'), key).toString('base64url');
}

function canonicalPairingTranscript(input) {
  const census = {
    appointments: Number(input.census.appointments) || 0,
    expenses: Number(input.census.expenses) || 0,
    labCases: Number(input.census.labCases) || 0,
    notes: Number(input.census.notes) || 0,
    patients: Number(input.census.patients) || 0,
    payments: Number(input.census.payments) || 0,
    prescriptions: Number(input.census.prescriptions) || 0,
    total: Number(input.census.total) || 0,
    treatments: Number(input.census.treatments) || 0,
  };
  return JSON.stringify({
    census,
    challenge: String(input.challenge || ''),
    devicePublicKey: String(input.devicePublicKey || ''),
    emptyClinic: input.emptyClinic === true,
    installationId: String(input.installationId || ''),
    licenseId: String(input.licenseId || ''),
    protocolVersion: Number(input.protocolVersion) || 0,
  });
}

function deviceTrustHeaders(privateKeyB64, method, urlPath, body, nowMs = Date.now()) {
  const timestamp = String(nowMs);
  const bodySha256 = crypto.createHash('sha256').update(body || '').digest('hex');
  const payload = ['DNDEV1', timestamp, String(method || '').toUpperCase(), String(urlPath || ''), bodySha256].join('\n');
  return {
    'x-dentalnova-device-ts': timestamp,
    'x-dentalnova-device-sig': signWithDeviceKey(privateKeyB64, payload),
  };
}

function signTestLicense(rsaPrivatePem, installationId, extra = {}) {
  const payload = {
    product: 'DNT Dental',
    clinicId: extra.clinicId || 'SEC-CLINIC',
    clinicName: extra.clinicName || 'Security Clinic',
    licenseId: extra.licenseId || crypto.randomUUID(),
    installationId,
    issuedAt: new Date().toISOString(),
    expiresAt: extra.expiresAt ?? null,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payloadJson);
  signer.end();
  return {
    license: `${payloadB64}.${signer.sign(rsaPrivatePem).toString('base64url')}`,
    licenseId: payload.licenseId,
  };
}

function emptyCensus() {
  return { patients: 0, payments: 0, treatments: 0, appointments: 0, total: 0 };
}

function pairingCompleteBody(code, extra = {}) {
  const census = extra.census || emptyCensus();
  const challenge = extra.challenge;
  const installationId = extra.installationId || '';
  const protocolVersion = extra.protocolVersion == null ? 3 : extra.protocolVersion;
  const keys = extra.keys || generateDeviceKeypair();
  const licenseId = extra.licenseId || '';
  const proofInput = {
    protocolVersion,
    challenge,
    installationId,
    emptyClinic: extra.emptyClinic !== false,
    census,
    devicePublicKey: extra.devicePublicKey || keys.publicKey,
    licenseId,
  };
  const body = {
    code,
    deviceName: extra.deviceName || 'Test PC',
    installationId,
    emptyClinic: extra.emptyClinic !== false,
    census,
    protocolVersion,
    challenge,
    censusProof: extra.censusProof || signCensusProof(challenge, proofInput),
    devicePublicKey: extra.devicePublicKey || keys.publicKey,
    pairingSignature:
      extra.pairingSignature ||
      signWithDeviceKey(keys.privateKey, canonicalPairingTranscript(proofInput)),
    license: extra.license || '',
  };
  if (extra.omitProof) delete body.censusProof;
  if (extra.omitChallenge) delete body.challenge;
  if (extra.omitTrust) {
    delete body.devicePublicKey;
    delete body.pairingSignature;
    delete body.license;
  }
  return body;
}

function setupPayload(clinicName, username) {
  return {
    clinicName,
    doctorName: `${clinicName} Admin`,
    clinicPhone: '0790000001',
    doctorPhone: '0790000002',
    workingDays: '0,1,2,3,4,5,6',
    workStartTime: '09:00',
    workEndTime: '18:00',
    adminUsername: username,
    adminPhone: username === 'synca' ? '0791111111' : '0792222222',
    adminPassword: 'Password123',
  };
}

async function waitForHealth(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Server did not become healthy');
}

async function main() {
  if (!fs.existsSync(MAIN)) {
    throw new Error('server/dist/main.js is missing. Run npm run build:server first.');
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-security-sync-'));
  const keysDir = path.join(dataDir, 'keys');
  fs.mkdirSync(keysDir, { recursive: true });
  const { publicKey: licensePublic, privateKey: licensePrivate } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  fs.writeFileSync(path.join(keysDir, 'license-public.pem'), licensePublic.export({ type: 'spki', format: 'pem' }));

  const child = spawn(process.execPath, [MAIN], {
    cwd: path.join(ROOT, 'server'),
    env: {
      ...process.env,
      PORT,
      HOST: '127.0.0.1',
      DEPLOYMENT_MODE: 'online',
      JWT_SECRET,
      JWT_EXPIRES_IN: '1h',
      DNT_DATA_DIR: dataDir,
      DATABASE_FILE: path.join(dataDir, 'data', 'clinic.db'),
      MIGRATIONS_DIR: path.join(ROOT, 'database', 'migrations'),
      LICENSE_KEYS_DIR: keysDir,
      DIBNOVA_ADMIN_USERNAME: 'dibadmin',
      DIBNOVA_ADMIN_PASSWORD: 'dibadmin-pass',
      NODE_ENV: 'test',
      SERVE_CLIENT: '0',
      ONLINE_CLINIC_SIGNUP: 'open',
      AI_SERVICE_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (c) => {
    output += c.toString();
  });
  child.stderr.on('data', (c) => {
    output += c.toString();
  });

  try {
    await waitForHealth();

    const clinicA = await request('POST', '/installation/setup', {
      body: setupPayload('Sync Clinic A', 'synca'),
      expected: [200, 201],
    });
    const clinicB = await request('POST', '/installation/setup', {
      body: setupPayload('Sync Clinic B', 'syncb'),
      expected: [200, 201],
    });

    const adminLogin = await request('POST', '/dibnova-admin/auth/login', {
      body: { username: 'dibadmin', password: 'dibadmin-pass' },
      expected: [200, 201],
    });
    const adminToken = adminLogin.data.accessToken;
    await request('POST', `/dibnova-admin/clinics/${clinicA.data.user.clinicId}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'A' },
      expected: [200, 201],
    });
    await request('POST', `/dibnova-admin/clinics/${clinicB.data.user.clinicId}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'B' },
      expected: [200, 201],
    });

    const loginA = await request('POST', '/auth/login', {
      body: { username: 'synca', password: 'Password123' },
      expected: [200, 201],
    });
    const loginB = await request('POST', '/auth/login', {
      body: { username: 'syncb', password: 'Password123' },
      expected: [200, 201],
    });
    const tokenA = loginA.data.accessToken;
    const tokenB = loginB.data.accessToken;

    const recovery = await request('POST', '/dibnova-admin/recovery-code', {
      token: adminToken,
      body: { clinicId: clinicA.data.user.clinicId },
      expected: [200, 201],
    });
    const reset = await request('POST', '/auth/forgot-password', {
      body: { username: 'synca', recoveryCode: recovery.data.recoveryCode },
      expected: [200, 201],
    });
    assert(reset.data.resetToken, 'reset token missing');
    const resetAsSession = await request('GET', '/auth/me', { token: reset.data.resetToken });
    assert(resetAsSession.status === 401, `password-reset JWT must not work as session (got ${resetAsSession.status})`);

    const ai = await request('POST', '/ai-provider/generate', {
      headers: { 'x-dentalnova-ai-key': 'DentalNova.AI.Proxy.v1' },
      body: { systemPrompt: 'x', messages: [{ role: 'user', content: 'hi' }] },
    });
    assert(ai.status === 401 || ai.status === 503, `default AI secret must be rejected (got ${ai.status})`);

    const patientA = await request('POST', '/patients', {
      token: tokenA,
      body: { fullName: 'Sync Patient A', phone: '0793000099', gender: 'MALE' },
      expected: [200, 201],
    });

    const pairing = await request('POST', '/sync/pairing/start', { token: tokenA, expected: [200, 201] });
    assert(pairing.data.code, 'pairing code missing');
    assert(pairing.data.challenge, 'pairing start must issue a census challenge');
    assert(pairing.data.protocolVersion === 3, 'pairing start must advertise protocol v3');
    assert(pairing.data.clinicName === 'Sync Clinic A', 'pairing start must show clinic name');
    assert(pairing.data.clinicId === clinicA.data.user.clinicId, 'pairing start must show clinic id');
    assert(pairing.data.onlineUrl, 'pairing start must show Online URL');
    const preview = await request('POST', '/sync/pairing/preview', {
      body: { code: pairing.data.code },
      expected: [200, 201],
    });
    assert(preview.data.clinicName === 'Sync Clinic A', 'preview must confirm clinic name');
    assert(preview.data.clinicId === clinicA.data.user.clinicId, 'preview must confirm clinic id');
    assert(preview.data.challenge === pairing.data.challenge, 'preview must return the pairing challenge');
    assert(!preview.data.deviceSecret && !preview.data.deviceId, 'preview must not issue device credentials');
    const previewAgain = await request('POST', '/sync/pairing/preview', {
      body: { code: pairing.data.code },
      expected: [200, 201],
    });
    assert(previewAgain.data.clinicId === clinicA.data.user.clinicId, 'preview must not consume the pairing code');
    const badPreview = await request('POST', '/sync/pairing/preview', { body: { code: 'NOPECODE' } });
    assert(badPreview.status === 401 || badPreview.status === 400, `unknown pairing code must fail (got ${badPreview.status})`);
    assert(String(badPreview.data?.message || '').toLowerCase() !== 'unexpected server error', 'unknown pairing code must not 500');
    const connectOnOnline = await request('POST', '/sync/connect', {
      token: tokenA,
      body: { onlineUrl: 'https://dentalnova.dibnova.com', pairingCode: pairing.data.code },
    });
    assert(connectOnOnline.status === 400, `Online server must not accept Offline connect (got ${connectOnOnline.status})`);
    const emptyCensusPayload = emptyCensus();
    const refusePopulated = await request('POST', '/sync/pairing/complete', {
      body: { code: pairing.data.code, deviceName: 'Test PC', emptyClinic: false },
    });
    assert(refusePopulated.status === 400, `emptyClinic:false must be rejected (got ${refusePopulated.status})`);
    const refuseNoCensus = await request('POST', '/sync/pairing/complete', {
      body: { code: pairing.data.code, deviceName: 'Test PC', emptyClinic: true },
    });
    assert(refuseNoCensus.status === 400, `pairing without census must be rejected (got ${refuseNoCensus.status})`);
    const refuseNonZeroCensusKeys = generateDeviceKeypair();
    const refuseNonZeroLic = signTestLicense(licensePrivate, 'nonzero-install');
    const refuseNonZeroCensus = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: { patients: 2, payments: 0, treatments: 0, appointments: 0, total: 2 },
        keys: refuseNonZeroCensusKeys,
        installationId: 'nonzero-install',
        license: refuseNonZeroLic.license,
        licenseId: refuseNonZeroLic.licenseId,
      }),
    });
    assert(refuseNonZeroCensus.status === 400, `non-zero census must be rejected (got ${refuseNonZeroCensus.status})`);
    const refuseBadProofKeys = generateDeviceKeypair();
    const refuseBadLic = signTestLicense(licensePrivate, 'badproof-install');
    const refuseBadProof = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensusPayload,
        censusProof: 'aa'.repeat(32),
        keys: refuseBadProofKeys,
        installationId: 'badproof-install',
        license: refuseBadLic.license,
        licenseId: refuseBadLic.licenseId,
      }),
    });
    assert(refuseBadProof.status === 400, `forged census proof must be rejected (got ${refuseBadProof.status})`);
    const refuseNoProof = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensusPayload,
        omitProof: true,
      }),
    });
    assert(refuseNoProof.status === 400, `pairing without censusProof must be rejected (got ${refuseNoProof.status})`);

    const customClientOnlyCode = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensusPayload,
        installationId: 'untrusted-custom',
        omitTrust: true,
      }),
    });
    assert(
      customClientOnlyCode.status === 400,
      `custom client with only a pairing code must not complete pairing (got ${customClientOnlyCode.status})`,
    );

    const forgedLicenseKeys = generateDeviceKeypair();
    const forgedLicense = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensusPayload,
        installationId: 'untrusted-custom',
        keys: forgedLicenseKeys,
        license: 'not-a-real-license.sig',
        licenseId: 'forged',
      }),
    });
    assert(
      forgedLicense.status === 400,
      `custom client with a forged license must not pair (got ${forgedLicense.status})`,
    );

    const v2Bypass = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensusPayload,
        installationId: 'untrusted-custom',
        protocolVersion: 2,
        omitTrust: true,
      }),
      protocol: 2,
    });
    assert(v2Bypass.status === 400, `protocol v2 pairing complete must not skip device trust (got ${v2Bypass.status})`);

    const officialKeys = generateDeviceKeypair();
    const officialLic = signTestLicense(licensePrivate, 'inst-a');
    const complete = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        installationId: 'inst-a',
        census: emptyCensusPayload,
        deviceName: 'Test PC',
        keys: officialKeys,
        license: officialLic.license,
        licenseId: officialLic.licenseId,
      }),
      expected: [200, 201],
    });
    assert(complete.data.deviceId && complete.data.deviceSecret, 'device credentials missing');
    assert(complete.data.clinicId === clinicA.data.user.clinicId, 'device must bind to clinic A');
    const pairingAgain = await request('POST', '/sync/pairing/start', { token: tokenA, expected: [200, 201] });
    const reuseInstall = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairingAgain.data.code, {
        challenge: pairingAgain.data.challenge,
        installationId: 'inst-a',
        census: emptyCensusPayload,
        keys: generateDeviceKeypair(),
        license: officialLic.license,
        licenseId: officialLic.licenseId,
      }),
    });
    assert(
      reuseInstall.status === 400,
      `the same licensed installation must not pair a second active device (got ${reuseInstall.status})`,
    );
    const usedPreview = await request('POST', '/sync/pairing/preview', { body: { code: pairing.data.code } });
    assert(usedPreview.status === 401 || usedPreview.status === 400, 'consumed pairing code must not preview');

    const tokenBody = { deviceId: complete.data.deviceId, deviceSecret: complete.data.deviceSecret };
    const unsignedTok = await request('POST', '/sync/token', { body: tokenBody });
    assert(unsignedTok.status === 401, `key-bound device token without signature must fail (got ${unsignedTok.status})`);
    const otherKeys = generateDeviceKeypair();
    const wrongSigTok = await request('POST', '/sync/token', {
      body: tokenBody,
      headers: deviceTrustHeaders(otherKeys.privateKey, 'POST', '/api/sync/token', JSON.stringify(tokenBody)),
    });
    assert(wrongSigTok.status === 401, `token signed by a custom client key must fail (got ${wrongSigTok.status})`);
    const deviceTok = await request('POST', '/sync/token', {
      body: tokenBody,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'POST', '/api/sync/token', JSON.stringify(tokenBody)),
      expected: [200, 201],
    });
    const deviceToken = deviceTok.data.accessToken;
    const earlyPushBody = {
        changes: [
          {
            changeId: 'too-early-1',
            entity: 'patients',
            recordUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            op: 'upsert',
            row: { fullName: 'Too Early', phone: '0700000999', fileNumber: 'P-EARLY', gender: 'MALE' },
          },
        ],
    };
    const earlyPush = await request('POST', '/sync/push', {
      token: deviceToken,
      body: earlyPushBody,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'POST', '/api/sync/push', JSON.stringify(earlyPushBody)),
    });
    assert(
      earlyPush.status === 400,
      `operational PUSH before snapshot bootstrap must fail (got ${earlyPush.status})`,
    );
    const oldProtocol = await request('GET', '/sync/changes?since=0', {
      token: deviceToken,
      protocol: 1,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'GET', '/api/sync/changes?since=0', ''),
    });
    assert(oldProtocol.status === 400, `incompatible sync protocol must be refused (got ${oldProtocol.status})`);
    assert(
      String(oldProtocol.data?.code || oldProtocol.data?.message || '').includes('PROTOCOL') ||
        String(oldProtocol.data?.message || '').toLowerCase().includes('incompatible'),
      'protocol mismatch must be a clear error',
    );
    const noProtocol = await request('POST', '/sync/token', {
      body: tokenBody,
      protocol: false,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'POST', '/api/sync/token', JSON.stringify(tokenBody)),
    });
    assert(noProtocol.status === 400, `token without protocol header must be refused (got ${noProtocol.status})`);
    const meDevice = await request('GET', '/auth/me', { token: deviceToken });
    assert(meDevice.status === 401, 'device JWT must not be a doctor session');
    const statusA = await request('GET', '/sync/status', { token: tokenA, expected: 200 });
    const statusDump = JSON.stringify(statusA.data);
    assert(!statusDump.includes('deviceSecret'), 'sync status must not include device secret');
    assert(!statusDump.includes('secretHash'), 'sync status must not include secret hash');
    assert((statusA.data.devices || []).some((d) => d.id === complete.data.deviceId && !d.revokedAt), 'paired device must appear in status');

    const snapChanges = await collectSnapshot(deviceToken, officialKeys.privateKey);
    const hasPatient = snapChanges.some(
      (c) => c.entity === 'patients' && c.row && String(c.row.fullName || '').includes('Sync Patient A'),
    );
    assert(hasPatient, 'snapshot must include clinic A patient');

    const bulky = [];
    for (let i = 0; i < 80; i += 1) {
      bulky.push({
        changeId: `bulk-${i}`,
        entity: 'patients',
        recordUid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        op: 'upsert',
        row: {
          fullName: `Bulk ${i} ${'n'.repeat(1200)}`,
          phone: `0793${String(i).padStart(6, '0')}`,
          gender: 'MALE',
          fileNumber: `P-B${i}`,
        },
      });
    }
    const unsignedAfterBoot = await request('POST', '/sync/push', {
      token: deviceToken,
      body: { changes: bulky },
    });
    assert(
      unsignedAfterBoot.status === 401,
      `key-bound PUSH without device signature must fail (got ${unsignedAfterBoot.status})`,
    );
    const customKeyPush = await request('POST', '/sync/push', {
      token: deviceToken,
      body: { changes: bulky },
      headers: deviceTrustHeaders(otherKeys.privateKey, 'POST', '/api/sync/push', JSON.stringify({ changes: bulky })),
    });
    assert(
      customKeyPush.status === 401,
      `PUSH signed by an untrusted custom client key must fail (got ${customKeyPush.status})`,
    );
    const bulkyPush = await request('POST', '/sync/push', {
      token: deviceToken,
      body: { changes: bulky },
      headers: deviceTrustHeaders(officialKeys.privateKey, 'POST', '/api/sync/push', JSON.stringify({ changes: bulky })),
    });
    assert(
      bulkyPush.status === 200 || bulkyPush.status === 201,
      `121-scale bulky push must not 500 (got ${bulkyPush.status}): ${JSON.stringify(bulkyPush.data)}`,
    );
    assert(bulkyPush.data.accepted || bulkyPush.data.skipped || bulkyPush.data.conflicts, 'bulky push must return apply result');
    assert(String(bulkyPush.data.message || '') !== 'Unexpected server error', 'bulky push must not be opaque 500');

    const pushBaitBody = {
        changes: [
          {
            changeId: 'cross-1',
            entity: 'patients',
            recordUid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            op: 'upsert',
            row: { fullName: 'Injected into A', phone: '0700000000', fileNumber: 'P-SYNC01', gender: 'MALE' },
          },
        ],
    };
    const pushBait = await request('POST', '/sync/push', {
      token: deviceToken,
      body: pushBaitBody,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'POST', '/api/sync/push', JSON.stringify(pushBaitBody)),
      expected: [200, 201],
    });
    assert(pushBait.data.accepted, 'push should report accepted/skipped/conflicts');

    const listB = await request('GET', '/patients', { token: tokenB, expected: 200 });
    const namesB = (Array.isArray(listB.data) ? listB.data : []).map((p) => p.fullName);
    assert(!namesB.includes('Injected into A'), 'clinic B must not receive clinic A device writes');
    assert(!namesB.includes('Sync Patient A'), 'clinic B must not see clinic A patients via sync');

    const pairingB = await request('POST', '/sync/pairing/start', { token: tokenB, expected: [200, 201] });
    const keysB = generateDeviceKeypair();
    const licB = signTestLicense(licensePrivate, 'inst-b', { clinicId: 'SEC-CLINIC-B' });
    const completeB = await request('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairingB.data.code, {
        challenge: pairingB.data.challenge,
        deviceName: 'PC B',
        census: emptyCensus(),
        installationId: 'inst-b',
        keys: keysB,
        license: licB.license,
        licenseId: licB.licenseId,
      }),
      expected: [200, 201],
    });
    const tokBBody = { deviceId: completeB.data.deviceId, deviceSecret: completeB.data.deviceSecret };
    const tokB = await request('POST', '/sync/token', {
      body: tokBBody,
      headers: deviceTrustHeaders(keysB.privateKey, 'POST', '/api/sync/token', JSON.stringify(tokBBody)),
      expected: [200, 201],
    });
    const snapBChanges = await collectSnapshot(tokB.data.accessToken, keysB.privateKey);
    const leaked = snapBChanges.some(
      (c) => c.entity === 'patients' && c.row && String(c.row.fullName || '').includes('Sync Patient A'),
    );
    assert(!leaked, 'clinic B device snapshot must not include clinic A patients');

    await request('POST', `/sync/devices/${complete.data.deviceId}/revoke`, { token: tokenA, expected: [200, 201] });
    const revoked = await request('GET', '/sync/changes?since=0', {
      token: deviceToken,
      headers: deviceTrustHeaders(officialKeys.privateKey, 'GET', '/api/sync/changes?since=0', ''),
    });
    assert(revoked.status === 401, `revoked device must fail (got ${revoked.status})`);

    const idemKey = 'pay-idem-1';
    const payment1 = await request('POST', '/payments', {
      token: tokenA,
      headers: { 'X-Idempotency-Key': idemKey },
      body: { patientId: patientA.data.id, amount: 10, method: 'CASH' },
      expected: [200, 201],
    });
    const payment2 = await request('POST', '/payments', {
      token: tokenA,
      headers: { 'X-Idempotency-Key': idemKey },
      body: { patientId: patientA.data.id, amount: 10, method: 'CASH' },
      expected: [200, 201],
    });
    assert(payment1.data.id === payment2.data.id, 'idempotent payment replay must not duplicate');

    const summary = await request('GET', `/patients/${patientA.data.id}/account-summary`, {
      token: tokenA,
      expected: 200,
    });
    assert(typeof summary.data.creditCents === 'number', 'account summary must expose creditCents');
    assert(summary.data.remainingCents >= 0, 'remainingCents must stay >= 0');

    const traversalBody = { relativePath: '../../etc/passwd', contentBase64: Buffer.from('x').toString('base64') };
    const traversal = await request('POST', '/sync/files', {
      token: tokB.data.accessToken,
      body: traversalBody,
      headers: deviceTrustHeaders(keysB.privateKey, 'POST', '/api/sync/files', JSON.stringify(traversalBody)),
    });
    assert(traversal.status >= 400, `path traversal upload must fail (got ${traversal.status})`);

    const payConflictBody = {
        changes: [
          {
            changeId: 'pay-dup-1',
            entity: 'payments',
            recordUid: 'pay-uid-dup',
            op: 'upsert',
            row: { amountCents: 1000, date: '2026-01-01', method: 'CASH', note: 'a' },
          },
          {
            changeId: 'pay-dup-2',
            entity: 'payments',
            recordUid: 'pay-uid-dup',
            op: 'upsert',
            row: { amountCents: 9999, date: '2026-01-01', method: 'CASH', note: 'b' },
          },
        ],
    };
    const payConflict = await request('POST', '/sync/push', {
      token: tokB.data.accessToken,
      body: payConflictBody,
      headers: deviceTrustHeaders(keysB.privateKey, 'POST', '/api/sync/push', JSON.stringify(payConflictBody)),
      expected: [200, 201],
    });
    assert(
      (payConflict.data.conflicts || []).length >= 1 || (payConflict.data.accepted || []).length <= 1,
      'immutable payment rows must not silently overwrite',
    );

    let Database;
    try {
      Database = require(path.join(ROOT, 'server', 'node_modules', 'better-sqlite3'));
    } catch {
      Database = require('better-sqlite3');
    }
    const platformDb = new Database(path.join(dataDir, 'data', 'platform.db'));
    platformDb.prepare(`UPDATE sync_registered_devices SET public_key = NULL WHERE id = ?`).run(completeB.data.deviceId);
    platformDb.close();
    const legacyTok = await request('POST', '/sync/token', {
      body: tokBBody,
      expected: [200, 201],
    });
    assert(legacyTok.data.accessToken, 'legacy devices without a public key must still use deviceSecret');

    const clinicJwtAdmin = await request('GET', '/dibnova-admin/clinics', { token: tokenA });
    assert(clinicJwtAdmin.status === 401, `clinic session must not access Admin (got ${clinicJwtAdmin.status})`);

    const adminAsClinic = await request('GET', '/auth/me', { token: adminToken });
    assert(adminAsClinic.status === 401, `admin JWT must not work as clinic session (got ${adminAsClinic.status})`);

    const listed = await request('GET', '/dibnova-admin/clinics', { token: adminToken, expected: 200 });
    assert(
      !(listed.data || []).some((clinic) => clinic.passwordPlain),
      'Admin clinic list must not include stored passwords',
    );

    const health = await request('GET', '/dibnova-admin/ops/health', { token: adminToken, expected: 200 });
    assert(health.data.ok === true, 'admin health must be ok');
    assert(health.data.r2Configured === false || typeof health.data.r2Configured === 'boolean', 'r2Configured flag missing');

    const opsA = await request('GET', `/dibnova-admin/clinics/${clinicA.data.user.clinicId}/ops`, {
      token: adminToken,
      expected: 200,
    });
    const opsB = await request('GET', `/dibnova-admin/clinics/${clinicB.data.user.clinicId}/ops`, {
      token: adminToken,
      expected: 200,
    });
    assert(opsA.data.clinicId === clinicA.data.user.clinicId, 'ops A must be tenant-scoped');
    assert(opsB.data.clinicId === clinicB.data.user.clinicId, 'ops B must be tenant-scoped');
    assert(opsA.data.patientCount >= 1, 'clinic A ops should count its patient');
    assert(opsB.data.patientCount === 0, 'clinic B ops must not include clinic A patients');

    const unknownOps = await request('GET', '/dibnova-admin/clinics/not-a-clinic/ops', { token: adminToken });
    assert(unknownOps.status >= 400, `unknown clinic ops must fail (got ${unknownOps.status})`);

    console.log('PASS: security + clinic sync');
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 400));
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
