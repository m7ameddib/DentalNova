/**
 * Online multi-clinic isolation test.
 * Requires a built server (server/dist/main.js) and starts a temporary
 * online instance with its own data directory.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAIN = path.join(ROOT, 'server', 'dist', 'main.js');
const PORT = process.env.MULTICLINIC_TEST_PORT || '4107';
const BASE = `http://127.0.0.1:${PORT}/api`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isOkStatus(status, expected) {
  if (Array.isArray(expected)) return expected.includes(status);
  if (expected) return status === expected;
  return true;
}

async function request(method, urlPath, { token, body, expected } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (expected && !isOkStatus(res.status, expected)) {
    throw new Error(`${method} ${urlPath} expected ${expected}, got ${res.status}: ${text}`);
  }
  return { status: res.status, data };
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
    adminPhone: username === 'clinica' ? '0791111111' : '0792222222',
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

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-multiclinic-'));
  const migrationsDir = path.join(ROOT, 'database', 'migrations');
  const child = spawn(process.execPath, [MAIN], {
    cwd: path.join(ROOT, 'server'),
    env: {
      ...process.env,
      PORT,
      HOST: '127.0.0.1',
      DEPLOYMENT_MODE: 'online',
      JWT_SECRET: 'multiclinic-test-jwt-secret-value-32chars',
      JWT_EXPIRES_IN: '1h',
      DNT_DATA_DIR: dataDir,
      DATABASE_FILE: path.join(dataDir, 'data', 'clinic.db'),
      MIGRATIONS_DIR: migrationsDir,
      DIBNOVA_ADMIN_USERNAME: 'dibadmin',
      DIBNOVA_ADMIN_PASSWORD: 'dibadmin-pass',
      NODE_ENV: 'test',
      SERVE_CLIENT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHealth();

    const status = await request('GET', '/installation/status', { expected: 200 });
    assert(status.data.deploymentMode === 'online', 'status should be online');
    assert(status.data.canCreateClinic === true, 'online status must allow clinic creation');
    assert(status.data.phase === 'ready', 'online public phase should remain ready/loginable');

    const clinicA = await request('POST', '/installation/setup', {
      body: setupPayload('Clinic A', 'clinica'),
      expected: [200, 201],
    });
    assert(clinicA.data.onlineSubscriptionStatus === 'PENDING', 'Clinic A should start PENDING');
    assert(clinicA.data.user.clinicId, 'Clinic A session must include clinicId');

    const clinicB = await request('POST', '/installation/setup', {
      body: setupPayload('Clinic B', 'clinicb'),
      expected: [200, 201],
    });
    assert(clinicB.data.user.clinicId !== clinicA.data.user.clinicId, 'clinics must have distinct ids');

    const duplicate = await request('POST', '/installation/setup', {
      body: setupPayload('Clinic Dup', 'clinica'),
    });
    assert(duplicate.status === 409, 'duplicate global username must be rejected');

    const adminLogin = await request('POST', '/dibnova-admin/auth/login', {
      body: { username: 'dibadmin', password: 'dibadmin-pass' },
      expected: [200, 201],
    });
    const adminToken = adminLogin.data.accessToken;
    assert(adminToken, 'admin login failed');

    const adminInfo = await request('GET', '/dibnova-admin/installation', { token: adminToken, expected: 200 });
    assert(Array.isArray(adminInfo.data.clinics) && adminInfo.data.clinics.length === 2, 'admin must see both clinics');

    await request('POST', `/dibnova-admin/clinics/${clinicA.data.user.clinicId}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'activate A' },
      expected: [200, 201],
    });
    await request('POST', `/dibnova-admin/clinics/${clinicB.data.user.clinicId}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'activate B' },
      expected: [200, 201],
    });

    const loginA = await request('POST', '/auth/login', {
      body: { username: 'clinica', password: 'Password123' },
      expected: [200, 201],
    });
    const loginB = await request('POST', '/auth/login', {
      body: { username: 'clinicb', password: 'Password123' },
      expected: [200, 201],
    });
    assert(loginA.data.user.clinicId === clinicA.data.user.clinicId, 'login A clinic binding');
    assert(loginB.data.user.clinicId === clinicB.data.user.clinicId, 'login B clinic binding');

    const tokenA = loginA.data.accessToken;
    const tokenB = loginB.data.accessToken;

    await request('POST', '/users', {
      token: tokenA,
      body: { fullName: 'Staff A', username: 'staffa', password: 'Password123', roleName: 'employee' },
      expected: [200, 201],
    });
    await request('POST', '/users', {
      token: tokenB,
      body: { fullName: 'Staff B', username: 'staffb', password: 'Password123', roleName: 'employee' },
      expected: [200, 201],
    });

    const usersA = await request('GET', '/users', { token: tokenA, expected: 200 });
    const usersB = await request('GET', '/users', { token: tokenB, expected: 200 });
    const namesA = usersA.data.map((u) => u.username).sort();
    const namesB = usersB.data.map((u) => u.username).sort();
    assert(namesA.includes('clinica') && namesA.includes('staffa'), 'Clinic A users missing');
    assert(!namesA.includes('clinicb') && !namesA.includes('staffb'), 'Clinic A leaked Clinic B users');
    assert(namesB.includes('clinicb') && namesB.includes('staffb'), 'Clinic B users missing');
    assert(!namesB.includes('clinica') && !namesB.includes('staffa'), 'Clinic B leaked Clinic A users');

    const patientA = await request('POST', '/patients', {
      token: tokenA,
      body: { fullName: 'Patient A', phone: '0793000001', gender: 'MALE' },
      expected: [200, 201],
    });
    assert(patientA.data?.id, `create patient A failed: ${JSON.stringify(patientA.data)}`);

    const loginStaffA = await request('POST', '/auth/login', {
      body: { username: 'staffa', password: 'Password123' },
      expected: [200, 201],
    });
    const tokenStaffA = loginStaffA.data.accessToken;
    assert(loginStaffA.data.user.clinicId === clinicA.data.user.clinicId, 'staff A must stay in Clinic A');

    const searchStaffA1 = await request('GET', '/patients?q=Patient%20A', { token: tokenStaffA, expected: 200 });
    const searchStaffA2 = await request('GET', '/patients?q=Patient%20A', { token: tokenStaffA, expected: 200 });
    await new Promise((r) => setTimeout(r, 50));
    const searchStaffA3 = await request('GET', '/patients?q=Patient%20A', { token: tokenStaffA, expected: 200 });
    const namesStaffA1 = (Array.isArray(searchStaffA1.data) ? searchStaffA1.data : []).map((p) => p.fullName);
    const namesStaffA2 = (Array.isArray(searchStaffA2.data) ? searchStaffA2.data : []).map((p) => p.fullName);
    const namesStaffA3 = (Array.isArray(searchStaffA3.data) ? searchStaffA3.data : []).map((p) => p.fullName);
    assert(namesStaffA1.includes('Patient A'), 'same-clinic staff must see Patient A on first search');
    assert(namesStaffA2.includes('Patient A'), 'same-clinic staff must still see Patient A on refetch');
    assert(namesStaffA3.includes('Patient A'), 'same-clinic staff must still see Patient A after a delayed refetch');

    const staffAById = await request('GET', `/patients/${patientA.data.id}`, { token: tokenStaffA, expected: 200 });
    assert(staffAById.data?.fullName === 'Patient A', 'same-clinic staff must open Patient A by id');

    const listStaffA = await request('GET', '/patients', { token: tokenStaffA, expected: 200 });
    const listStaffANames = (Array.isArray(listStaffA.data) ? listStaffA.data : []).map((p) => p.fullName);
    assert(listStaffANames.includes('Patient A'), 'same-clinic staff must see Patient A in the clinic list');

    const patientsB = await request('GET', '/patients', { token: tokenB, expected: 200 });
    const listB = Array.isArray(patientsB.data) ? patientsB.data : patientsB.data?.items || [];
    assert(listB.length === 0, 'Clinic B should not see Clinic A patients');

    const searchB = await request('GET', '/patients?q=Patient%20A', { token: tokenB, expected: 200 });
    const searchNamesB = Array.isArray(searchB.data) ? searchB.data : [];
    assert(searchNamesB.length === 0, 'Clinic B search must not return Clinic A patients');

    const cross = await request('GET', `/patients/${patientA.data.id}`, { token: tokenB });
    assert(cross.status === 404, `Clinic B must not read Clinic A patient by id (got ${cross.status})`);

    const settingsA = await request('GET', '/settings/clinic', { token: tokenA }).catch(async () =>
      request('GET', '/clinic-settings', { token: tokenA }),
    );
    const settingsB = await request('GET', '/settings/clinic', { token: tokenB }).catch(async () =>
      request('GET', '/clinic-settings', { token: tokenB }),
    );
    if (settingsA.status === 200 && settingsB.status === 200) {
      assert(settingsA.data.clinicName !== settingsB.data.clinicName, 'clinic settings must stay isolated');
    }

    await request('POST', `/dibnova-admin/clinics/${clinicA.data.user.clinicId}/subscription/suspend`, {
      token: adminToken,
      body: { reason: 'test suspend A' },
      expected: [200, 201],
    });
    const blocked = await request('GET', '/patients', { token: tokenA });
    assert(blocked.status === 403, `suspended Clinic A must be blocked (got ${blocked.status})`);
    const stillB = await request('GET', '/patients', { token: tokenB });
    assert(stillB.status === 200, 'Clinic B must remain usable after Clinic A is suspended');

    const afterAdmin = await request('GET', '/dibnova-admin/clinics', { token: adminToken, expected: 200 });
    const aRow = afterAdmin.data.find((c) => c.clinicId === clinicA.data.user.clinicId);
    const bRow = afterAdmin.data.find((c) => c.clinicId === clinicB.data.user.clinicId);
    assert(aRow.subscription.status === 'SUSPENDED', 'admin must see Clinic A suspended');
    assert(bRow.subscription.status === 'ACTIVE', 'admin must see Clinic B still active');

    console.log('PASS: online multi-clinic isolation');
    console.log(`  clinic A: ${clinicA.data.user.clinicId}`);
    console.log(`  clinic B: ${clinicB.data.user.clinicId}`);
  } catch (err) {
    console.error(output);
    throw err;
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows file locks may linger
    }
  }
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
