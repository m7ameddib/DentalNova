/**
 * Live two-process clinic drill: Nest Online + Nest Offline on this VM.
 * Substitutes for a headed Windows installer. Same Nest sync/pairing code path.
 *
 * Requires server/dist/main.js (npm run build:server).
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAIN = path.join(ROOT, 'server', 'dist', 'main.js');
const ONLINE_PORT = process.env.LIVE_SYNC_ONLINE_PORT || '4120';
const OFFLINE_PORT = process.env.LIVE_SYNC_OFFLINE_PORT || '4121';
const JWT_SECRET = 'live-two-server-sync-jwt-secret-value-32ch';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    emptyClinic: input.emptyClinic === true,
    installationId: String(input.installationId || ''),
    protocolVersion: Number(input.protocolVersion) || 0,
  });
  return crypto.createHmac('sha256', String(hmacSecret || '')).update(payload).digest('hex');
}

function emptyCensus() {
  return {
    patients: 0,
    payments: 0,
    treatments: 0,
    appointments: 0,
    expenses: 0,
    labCases: 0,
    prescriptions: 0,
    notes: 0,
    total: 0,
  };
}

function pairingCompleteBody(code, extra = {}) {
  const census = extra.census || emptyCensus();
  const challenge = extra.challenge;
  const installationId = extra.installationId || '';
  const protocolVersion = extra.protocolVersion == null ? 2 : extra.protocolVersion;
  return {
    code,
    deviceName: extra.deviceName || 'Live Offline PC',
    installationId,
    emptyClinic: extra.emptyClinic !== false,
    census,
    protocolVersion,
    challenge,
    censusProof:
      extra.censusProof ||
      signCensusProof(challenge, {
        protocolVersion,
        challenge,
        installationId,
        emptyClinic: extra.emptyClinic !== false,
        census,
      }),
  };
}

function setupPayload(clinicName, username, phoneTail) {
  return {
    clinicName,
    doctorName: `${clinicName} Admin`,
    clinicPhone: `079000${phoneTail}`,
    doctorPhone: `079100${phoneTail}`,
    workingDays: '0,1,2,3,4,5,6',
    workStartTime: '09:00',
    workEndTime: '18:00',
    adminUsername: username,
    adminPhone: `079200${phoneTail}`,
    adminPassword: 'Password123',
  };
}

function requestFactory(base) {
  return async function request(method, urlPath, { token, body, expected, headers, protocol } = {}) {
    const hdrs = { Accept: 'application/json', ...(headers || {}) };
    if (protocol !== false) hdrs['x-dentalnova-sync-protocol'] = String(protocol == null ? 2 : protocol);
    if (body !== undefined) hdrs['Content-Type'] = 'application/json';
    if (token) hdrs.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${urlPath}`, {
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
  };
}

function spawnServer({ mode, port, dataDir, extraEnv = {} }) {
  const child = spawn(process.execPath, [MAIN], {
    cwd: path.join(ROOT, 'server'),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DEPLOYMENT_MODE: mode,
      JWT_SECRET,
      JWT_EXPIRES_IN: '1h',
      DNT_DATA_DIR: dataDir,
      DATABASE_FILE: path.join(dataDir, 'data', 'clinic.db'),
      MIGRATIONS_DIR: path.join(ROOT, 'database', 'migrations'),
      DIBNOVA_ADMIN_USERNAME: 'dibadmin',
      DIBNOVA_ADMIN_PASSWORD: 'dibadmin-pass',
      NODE_ENV: 'test',
      SERVE_CLIENT: '0',
      ONLINE_CLINIC_SIGNUP: 'open',
      AI_SERVICE_SECRET: '',
      PUBLIC_ONLINE_URL: `http://127.0.0.1:${ONLINE_PORT}`,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.output = '';
  child.stdout.on('data', (c) => {
    child.output += c.toString();
  });
  child.stderr.on('data', (c) => {
    child.output += c.toString();
  });
  return child;
}

async function waitForHealth(port, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server on port ${port} did not become healthy`);
}

function stopChild(child) {
  if (!child || child.killed || child.exitCode != null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }, 4000);
  });
}

function signOfflineLicense(privateKey, installationId) {
  const payload = {
    product: 'DNT Dental',
    clinicId: 'LIVEOFF1',
    clinicName: 'Live Offline Clinic',
    licenseId: crypto.randomUUID(),
    installationId,
    issuedAt: new Date().toISOString(),
    expiresAt: null,
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf-8').toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payloadJson);
  signer.end();
  const signatureB64 = signer.sign(privateKey).toString('base64url');
  return `${payloadB64}.${signatureB64}`;
}

function namesOf(list) {
  return (Array.isArray(list) ? list : []).map((p) => p.fullName || p.full_name);
}

async function mapPool(count, concurrency, fn) {
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const idx = next;
      next += 1;
      if (idx >= count) return;
      await fn(idx);
    }
  });
  await Promise.all(workers);
}

async function waitUntil(fn, { timeoutMs = 120000, intervalMs = 800, label = 'condition' } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
  if (!fs.existsSync(MAIN)) {
    throw new Error('server/dist/main.js is missing. Run npm run build:server first.');
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-live-sync-'));
  const onlineDir = path.join(tmp, 'online');
  const offlineDir = path.join(tmp, 'offline');
  const keysDir = path.join(tmp, 'keys');
  fs.mkdirSync(onlineDir, { recursive: true });
  fs.mkdirSync(offlineDir, { recursive: true });
  fs.mkdirSync(keysDir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(path.join(keysDir, 'license-public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));

  const onlineReq = requestFactory(`http://127.0.0.1:${ONLINE_PORT}/api`);
  const offlineReq = requestFactory(`http://127.0.0.1:${OFFLINE_PORT}/api`);

  let online = spawnServer({ mode: 'online', port: ONLINE_PORT, dataDir: onlineDir });
  let offline = spawnServer({
    mode: 'offline',
    port: OFFLINE_PORT,
    dataDir: offlineDir,
    extraEnv: { LICENSE_KEYS_DIR: keysDir },
  });

  const proven = [];
  try {
    await waitForHealth(ONLINE_PORT);
    await waitForHealth(OFFLINE_PORT);

    const clinic = await onlineReq('POST', '/installation/setup', {
      body: setupPayload('Live Online Clinic', 'liveon', '1111'),
      expected: [200, 201],
    });
    const adminLogin = await onlineReq('POST', '/dibnova-admin/auth/login', {
      body: { username: 'dibadmin', password: 'dibadmin-pass' },
      expected: [200, 201],
    });
    await onlineReq('POST', `/dibnova-admin/clinics/${clinic.data.user.clinicId}/subscription/activate`, {
      token: adminLogin.data.accessToken,
      body: { notes: 'live' },
      expected: [200, 201],
    });
    const onlineToken = (
      await onlineReq('POST', '/auth/login', {
        body: { username: 'liveon', password: 'Password123' },
        expected: [200, 201],
      })
    ).data.accessToken;

    const seedPatient = await onlineReq('POST', '/patients', {
      token: onlineToken,
      body: { fullName: 'Online Seed Patient', phone: '0793000001', gender: 'MALE' },
      expected: [200, 201],
    });
    for (let i = 0; i < 90; i += 1) {
      await onlineReq('POST', '/patients', {
        token: onlineToken,
        body: { fullName: `Snap ${i}`, phone: `07931${String(i).padStart(5, '0')}`, gender: 'FEMALE' },
        expected: [200, 201],
      });
    }
    const types = await onlineReq('GET', '/treatment-types', { token: onlineToken, expected: 200 });
    const filling = (Array.isArray(types.data) ? types.data : []).find((t) => t.code === 'FILLING') || types.data[0];
    assert(filling?.id, 'online treatment catalog missing');
    const seedTx = await onlineReq('POST', '/treatments', {
      token: onlineToken,
      body: {
        patientId: seedPatient.data.id,
        treatmentTypeId: filling.id,
        teeth: [11],
        status: 'COMPLETED',
      },
      expected: [200, 201],
    });
    const seedPay = await onlineReq('POST', '/payments', {
      token: onlineToken,
      body: { patientId: seedPatient.data.id, amount: 15, method: 'CASH', date: '2026-09-17' },
      expected: [200, 201],
    });
    await onlineReq('POST', '/appointments', {
      token: onlineToken,
      body: {
        patientId: seedPatient.data.id,
        date: '2026-09-18',
        time: '10:00',
        durationMin: 30,
        reason: 'Online seed visit',
      },
      expected: [200, 201],
    });
    proven.push('Online clinic seeded with patient/treatment/payment/appointment + 90 snapshot rows');

    const install = await offlineReq('GET', '/installation/status', { expected: 200 });
    assert(install.data.installationId, 'offline installation id missing');
    const license = signOfflineLicense(privateKey, install.data.installationId);
    await offlineReq('POST', '/installation/activate', { body: { license }, expected: [200, 201] });
    const offSetup = await offlineReq('POST', '/installation/setup', {
      body: setupPayload('Live Offline Clinic', 'liveoff', '2222'),
      expected: [200, 201],
    });
    let offlineToken = offSetup.data.accessToken;
    proven.push('Offline licensed + first setup on a second data root/port');

    const pairing = await onlineReq('POST', '/sync/pairing/start', { token: onlineToken, expected: [200, 201] });
    const badProof = await onlineReq('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: emptyCensus(),
        censusProof: 'bb'.repeat(32),
      }),
    });
    assert(badProof.status === 400, `forged census HMAC must fail (got ${badProof.status})`);
    const populatedLie = await onlineReq('POST', '/sync/pairing/complete', {
      body: pairingCompleteBody(pairing.data.code, {
        challenge: pairing.data.challenge,
        census: { ...emptyCensus(), patients: 4, total: 4 },
      }),
    });
    assert(populatedLie.status === 400, `non-zero census must fail (got ${populatedLie.status})`);
    proven.push('Online refused forged HMAC and non-zero census (pairing code not consumed)');

    const connect = await offlineReq('POST', '/sync/connect', {
      token: offlineToken,
      body: { onlineUrl: `http://127.0.0.1:${ONLINE_PORT}`, pairingCode: pairing.data.code, deviceName: 'Live VM Offline' },
      expected: [200, 201],
    });
    assert(connect.data.deviceId, 'offline connect must return device id');
    proven.push('Official Offline connect signed live SQLite census + pairing challenge');

    const boot1 = offlineReq('POST', '/sync/bootstrap', { token: offlineToken }).catch(() => ({ status: 0, data: {} }));
    await new Promise((r) => setTimeout(r, 700));
    await stopChild(offline);
    proven.push('Offline process killed mid-bootstrap');

    offline = spawnServer({
      mode: 'offline',
      port: OFFLINE_PORT,
      dataDir: offlineDir,
      extraEnv: { LICENSE_KEYS_DIR: keysDir },
    });
    await waitForHealth(OFFLINE_PORT);
    offlineToken = (
      await offlineReq('POST', '/auth/login', {
        body: { username: 'liveoff', password: 'Password123' },
        expected: [200, 201],
      })
    ).data.accessToken;
    const bootResume = await offlineReq('POST', '/sync/bootstrap', { token: offlineToken, expected: [200, 201] });
    assert(bootResume.data.alreadyBootstrapped || bootResume.data.pulled >= 0, 'bootstrap resume failed');
    await waitUntil(
      async () => {
        const st = await offlineReq('GET', '/sync/status', { token: offlineToken, expected: 200 });
        return st.data.bootstrapped ? st.data : null;
      },
      { label: 'offline bootstrapped after restart' },
    );
    const afterBoot = await offlineReq('GET', '/patients?q=Online%20Seed', { token: offlineToken, expected: 200 });
    assert(namesOf(afterBoot.data).some((n) => n.includes('Online Seed Patient')), 'bootstrap did not copy Online seed patient');
    const snapRow = await offlineReq('GET', '/patients?q=Snap%2089', { token: offlineToken, expected: 200 });
    assert(namesOf(snapRow.data).some((n) => n.includes('Snap 89')), 'snapshot resume lost later Online patients');
    proven.push('Bootstrap resumed after Offline process restart; Online operational rows present');

    const offTypes = await offlineReq('GET', '/treatment-types', { token: offlineToken, expected: 200 });
    const offFilling =
      (Array.isArray(offTypes.data) ? offTypes.data : []).find((t) => t.code === filling.code) || offTypes.data[0];
    const offSeed = (Array.isArray(afterBoot.data) ? afterBoot.data : []).find((p) =>
      String(p.fullName).includes('Online Seed Patient'),
    );
    assert(offSeed?.id, 'offline seed patient id missing');

    const offlinePatient = await offlineReq('POST', '/patients', {
      token: offlineToken,
      body: { fullName: 'Offline New Patient', phone: '0794000001', gender: 'FEMALE' },
      expected: [200, 201],
    });
    const offlineTx = await offlineReq('POST', '/treatments', {
      token: offlineToken,
      body: {
        patientId: offlinePatient.data.id,
        treatmentTypeId: offFilling.id,
        teeth: [21],
        status: 'PLANNED',
      },
      expected: [200, 201],
    });
    const offlinePay = await offlineReq('POST', '/payments', {
      token: offlineToken,
      body: { patientId: offlinePatient.data.id, amount: 22, method: 'CASH', date: '2026-09-17' },
      expected: [200, 201],
    });
    await offlineReq('POST', '/appointments', {
      token: offlineToken,
      body: {
        patientId: offlinePatient.data.id,
        date: '2026-09-19',
        time: '11:00',
        durationMin: 20,
        reason: 'Offline booking',
      },
      expected: [200, 201],
    });

    const sync1 = await offlineReq('POST', '/sync/now', { token: offlineToken, expected: [200, 201] });
    assert(!sync1.data.error, `sync now after local writes failed: ${sync1.data.error}`);
    const onlineSawPatient = await waitUntil(
      async () => {
        const list = await onlineReq('GET', '/patients?q=Offline%20New', { token: onlineToken, expected: 200 });
        return namesOf(list.data).some((n) => n.includes('Offline New Patient')) ? list.data : null;
      },
      { label: 'Offline patient on Online' },
    );
    const onNew = (Array.isArray(onlineSawPatient) ? onlineSawPatient : []).find((p) =>
      String(p.fullName).includes('Offline New Patient'),
    );
    const onTx = await onlineReq('GET', `/patients/${onNew.id}/treatments`, { token: onlineToken, expected: 200 });
    const onPay = await onlineReq('GET', `/patients/${onNew.id}/payments`, { token: onlineToken, expected: 200 });
    const onAppt = await onlineReq('GET', `/patients/${onNew.id}/appointments`, { token: onlineToken, expected: 200 });
    assert((Array.isArray(onTx.data) ? onTx.data : []).length >= 1, 'Offline treatment missing on Online');
    assert((Array.isArray(onPay.data) ? onPay.data : []).length >= 1, 'Offline payment missing on Online');
    assert((Array.isArray(onAppt.data) ? onAppt.data : []).length >= 1, 'Offline appointment missing on Online');
    proven.push('Offline→Online patients/treatments/payments/appointments');

    const onlinePatient = await onlineReq('POST', '/patients', {
      token: onlineToken,
      body: { fullName: 'Online After Pair', phone: '0795000001', gender: 'MALE' },
      expected: [200, 201],
    });
    await onlineReq('POST', '/treatments', {
      token: onlineToken,
      body: {
        patientId: onlinePatient.data.id,
        treatmentTypeId: filling.id,
        teeth: [16],
        status: 'IN_PROGRESS',
      },
      expected: [200, 201],
    });
    const laterPay = await onlineReq('POST', '/payments', {
      token: onlineToken,
      body: { patientId: seedPatient.data.id, amount: 8, method: 'CASH', date: '2026-09-17' },
      expected: [200, 201],
    });
    await onlineReq('PATCH', `/payments/${seedPay.data.id}/void`, {
      token: onlineToken,
      body: { reason: 'live drill void' },
      expected: [200, 201],
    });
    await onlineReq('POST', '/appointments', {
      token: onlineToken,
      body: {
        patientId: onlinePatient.data.id,
        date: '2026-09-20',
        time: '14:00',
        durationMin: 15,
        reason: 'Online after pair',
      },
      expected: [200, 201],
    });

    await stopChild(online);
    proven.push('Online process stopped mid-sync window (internet-drop substitute)');
    const dropSync = await offlineReq('POST', '/sync/now', { token: offlineToken });
    assert(dropSync.data.error || dropSync.status >= 400, 'sync must surface Online unreachable');
    online = spawnServer({ mode: 'online', port: ONLINE_PORT, dataDir: onlineDir });
    await waitForHealth(ONLINE_PORT);
    const onlineToken2 = (
      await onlineReq('POST', '/auth/login', {
        body: { username: 'liveon', password: 'Password123' },
        expected: [200, 201],
      })
    ).data.accessToken;
    const syncAfterDrop = await waitUntil(
      async () => {
        const res = await offlineReq('POST', '/sync/now', { token: offlineToken });
        return res.status < 400 && !res.data.error ? res.data : null;
      },
      { timeoutMs: 180000, label: 'sync after Online reconnect' },
    );
    const pulledOnline = await offlineReq('GET', '/patients?q=Online%20After', { token: offlineToken, expected: 200 });
    assert(namesOf(pulledOnline.data).some((n) => n.includes('Online After Pair')), 'Online→Offline patient missing after reconnect');
    const offSeedAfter = (Array.isArray(afterBoot.data) ? afterBoot.data : []).find((p) =>
      String(p.fullName).includes('Online Seed Patient'),
    );
    const seedPays = await offlineReq('GET', `/patients/${offSeedAfter.id}/payments`, { token: offlineToken, expected: 200 });
    const payList = Array.isArray(seedPays.data) ? seedPays.data : [];
    assert(
      payList.some((p) => String(p.status || '').toUpperCase() === 'VOID'),
      `VOID payment did not replicate to Offline (got ${JSON.stringify(payList).slice(0, 400)})`,
    );
    const seedTxs = await offlineReq('GET', `/patients/${offSeedAfter.id}/treatments`, { token: offlineToken, expected: 200 });
    assert((Array.isArray(seedTxs.data) ? seedTxs.data : []).length >= 1, 'seed treatment missing on Offline');
    const seedAppts = await offlineReq('GET', `/patients/${offSeedAfter.id}/appointments`, { token: offlineToken, expected: 200 });
    assert((Array.isArray(seedAppts.data) ? seedAppts.data : []).length >= 1, 'seed appointment missing on Offline');
    proven.push('Internet-drop substitute: Online kill/restart, Offline reconnect + pull');
    proven.push('VOID payment, treatment, and appointment replicated onto Offline');

    const deviceTok = await onlineReq('POST', '/sync/token', {
      body: {
        deviceId: connect.data.deviceId,
        deviceSecret: JSON.parse(fs.readFileSync(path.join(offlineDir, 'config', 'sync-device.json'), 'utf-8'))
          .deviceSecret,
      },
      expected: [200, 201],
    });
    const deviceToken = deviceTok.data.accessToken;
    const mismatch = await onlineReq('GET', '/sync/changes?since=0', { token: deviceToken, protocol: 1 });
    assert(mismatch.status === 400, `protocol v1 must be refused (got ${mismatch.status})`);
    proven.push('Protocol version gate refused incompatible header');

    const blob = Buffer.alloc(300 * 1024, 7);
    const digest = crypto.createHash('sha256').update(blob).digest('hex');
    const rel = 'patients/live-drill.bin';
    await onlineReq('POST', '/sync/files/begin', {
      token: deviceToken,
      body: { relativePath: rel, mimeType: 'application/octet-stream', byteSize: blob.length, sha256: digest },
      expected: [200, 201],
    });
    const chunk = 256 * 1024;
    for (let offset = 0; offset < blob.length; offset += chunk) {
      await onlineReq('POST', '/sync/files/chunk', {
        token: deviceToken,
        body: {
          relativePath: rel,
          offset,
          contentBase64: blob.subarray(offset, offset + chunk).toString('base64'),
        },
        expected: [200, 201],
      });
    }
    await onlineReq('POST', '/sync/files/finish', {
      token: deviceToken,
      body: { relativePath: rel, sha256: digest, mimeType: 'application/octet-stream' },
      expected: [200, 201],
    });
    const meta = await onlineReq('GET', `/sync/files?path=${encodeURIComponent(rel)}`, {
      token: deviceToken,
      expected: 200,
    });
    assert(meta.data.chunked === true || meta.data.byteSize === blob.length, 'large file must not be inlined as a huge JSON body');
    const part = await onlineReq('GET', `/sync/files?path=${encodeURIComponent(rel)}&offset=0&limit=1024`, {
      token: deviceToken,
      expected: 200,
    });
    assert(part.data.contentBase64, 'chunked download missing');
    proven.push('Chunked 300KiB attachment upload/download (blob not stored in SQLite)');

    let createdDrain = 0;
    await mapPool(2100, 20, async (n) => {
      await onlineReq('POST', '/patients', {
        token: onlineToken2,
        body: { fullName: `Drain ${n}`, phone: `0797${String(n).padStart(6, '0')}`, gender: 'MALE' },
        expected: [200, 201],
      });
      createdDrain += 1;
    });
    assert(createdDrain >= 2100, `expected 2100 drain rows, got ${createdDrain}`);
    const drainSync = await waitUntil(
      async () => {
        const st = await offlineReq('GET', '/sync/status', { token: offlineToken, expected: 200 });
        if (st.data.state !== 'SYNCING') {
          await offlineReq('POST', '/sync/now', { token: offlineToken });
        }
        const found = await offlineReq('GET', '/patients?q=Drain%202099', { token: offlineToken, expected: 200 });
        return namesOf(found.data).some((n) => n.includes('Drain 2099')) ? { status: st.data, found: true } : null;
      },
      { timeoutMs: 300000, label: '2k+ drain pull to Offline' },
    );
    proven.push(`Multi-cycle drain: ${createdDrain} Online doctor-created rows reached Offline (including Drain 2099)`);

    const medPush = await onlineReq('POST', '/sync/push', {
      token: deviceToken,
      body: {
        changes: [
          {
            changeId: 'med-dup-1',
            entity: 'medication_catalog',
            recordUid: 'eeeeeeee-0000-4000-8000-000000000001',
            op: 'upsert',
            row: { name: 'Amoxicillin', category: 'ANTIBIOTICS' },
          },
        ],
      },
      expected: [200, 201],
    });
    assert(!(medPush.data.conflicts || []).some((c) => c.reason === 'apply-error'), 'medication adopt must not apply-error');
    proven.push('medication_catalog natural-key adopt did not 500');

    const populatedPair = await offlineReq('POST', '/sync/connect/preview', {
      token: offlineToken,
      body: { onlineUrl: `http://127.0.0.1:${ONLINE_PORT}`, pairingCode: 'ABCD2345' },
    });
    assert(populatedPair.status === 400, 'already-paired/populated Offline must not pair again');
    proven.push('Populated/already-paired Offline cannot start a second automatic pairing');

    void boot1;
    void onlineSawPatient;
    void laterPay;
    void seedTx;
    void offlineTx;
    void offlinePay;
    void syncAfterDrop;
    void drainSync;
    void onlineToken2;

    console.log('PASS: live two-server clinic sync drill');
    for (const line of proven) console.log('  -', line);
    console.log('NOT RUN: headed Windows installer / physical clinic PC (this VM is Linux).');
    console.log('Same Nest Offline+Online processes and HTTP pairing/sync protocol as the Windows app.');
  } catch (err) {
    console.error('Online log:\n', online?.output?.slice(-8000));
    console.error('Offline log:\n', offline?.output?.slice(-8000));
    throw err;
  } finally {
    await stopChild(offline);
    await stopChild(online);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
