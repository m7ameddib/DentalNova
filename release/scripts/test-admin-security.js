/**
 * DibNova Admin authentication, authorization, tenant isolation, and audit tests.
 * Requires server/dist/main.js (npm run build:server).
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAIN = path.join(ROOT, 'server', 'dist', 'main.js');
const PORT = process.env.ADMIN_SECURITY_TEST_PORT || '4110';
const BASE = `http://127.0.0.1:${PORT}/api`;
const JWT_SECRET = 'admin-security-test-jwt-secret-value-32ch';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, urlPath, { token, body, expected, headers } = {}) {
  const hdrs = { Accept: 'application/json', ...(headers || {}) };
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

function decodeJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return {};
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function signHs256(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
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
    adminPhone: username === 'adminsec-a' ? '0791111111' : '0792222222',
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

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-admin-security-'));
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

    const unauth = await request('GET', '/dibnova-admin/clinics');
    assert(unauth.status === 401, `unauthenticated admin list must be 401 (got ${unauth.status})`);

    const badLogin = await request('POST', '/dibnova-admin/auth/login', {
      body: { username: 'dibadmin', password: 'wrong-password' },
    });
    assert(badLogin.status === 401, `bad admin password must be 401 (got ${badLogin.status})`);

    const clinicA = await request('POST', '/installation/setup', {
      body: setupPayload('Admin Clinic A', 'adminsec-a'),
      expected: [200, 201],
    });
    const clinicB = await request('POST', '/installation/setup', {
      body: setupPayload('Admin Clinic B', 'adminsec-b'),
      expected: [200, 201],
    });
    const clinicIdA = clinicA.data.user.clinicId;
    const clinicIdB = clinicB.data.user.clinicId;

    const adminLogin = await request('POST', '/dibnova-admin/auth/login', {
      body: { username: 'dibadmin', password: 'dibadmin-pass' },
      expected: [200, 201],
    });
    const adminToken = adminLogin.data.accessToken;
    const adminPayload = decodeJwt(adminToken);
    assert(adminPayload.iss === 'dentalnova-admin', 'admin JWT issuer must be dentalnova-admin');
    assert(adminPayload.aud === 'dibnova-admin' || (Array.isArray(adminPayload.aud) && adminPayload.aud.includes('dibnova-admin')), 'admin JWT audience must be dibnova-admin');
    assert(adminPayload.purpose === 'dibnova_admin', 'admin JWT purpose must be dibnova_admin');
    assert(adminPayload.roleName === 'dibnova_admin', 'admin JWT role must be dibnova_admin');
    assert(adminPayload.dibnovaAdmin === true, 'admin JWT must set dibnovaAdmin');
    assert(adminPayload.jti, 'admin JWT must include jti');

    const me = await request('GET', '/dibnova-admin/auth/me', { token: adminToken, expected: 200 });
    assert(me.data.roleName === 'dibnova_admin', 'admin /me must return admin role');

    const clinicMe = await request('GET', '/auth/me', { token: adminToken });
    assert(clinicMe.status === 401, `admin JWT must not work as clinic session (got ${clinicMe.status})`);

    const clinicPatients = await request('GET', '/patients', { token: adminToken });
    assert(clinicPatients.status === 401, `admin JWT must not access clinic APIs (got ${clinicPatients.status})`);

    await request('POST', `/dibnova-admin/clinics/${clinicIdA}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'activate A' },
      expected: [200, 201],
    });
    await request('POST', `/dibnova-admin/clinics/${clinicIdB}/subscription/activate`, {
      token: adminToken,
      body: { notes: 'activate B' },
      expected: [200, 201],
    });

    const loginA = await request('POST', '/auth/login', {
      body: { username: 'adminsec-a', password: 'Password123' },
      expected: [200, 201],
    });
    const tokenA = loginA.data.accessToken;

    const clinicJwtAdmin = await request('GET', '/dibnova-admin/clinics', { token: tokenA });
    assert(clinicJwtAdmin.status === 401, `clinic JWT must not access Admin (got ${clinicJwtAdmin.status})`);

    const clinicReset = await request('POST', '/dibnova-admin/users/reset-password', {
      token: tokenA,
      body: { clinicId: clinicIdA, userId: 1, newPassword: 'HackedPass1' },
    });
    assert(clinicReset.status === 401, `clinic JWT must not reset passwords via Admin (got ${clinicReset.status})`);

    const forgedAdmin = signHs256(
      {
        sub: 1,
        username: 'adminsec-a',
        roleName: 'dibnova_admin',
        dibnovaAdmin: true,
        purpose: 'dibnova_admin',
        typ: 'dibnova-admin',
        clinicId: clinicIdA,
        iss: 'dentalnova-session',
        aud: 'dibnova-admin',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );
    const forged = await request('GET', '/dibnova-admin/clinics', { token: forgedAdmin });
    assert(forged.status === 401, `session-signed forged admin claims must not access Admin (got ${forged.status})`);

    const clinics = await request('GET', '/dibnova-admin/clinics', { token: adminToken, expected: 200 });
    assert(Array.isArray(clinics.data), 'clinics list must be an array');
    for (const clinic of clinics.data) {
      assert(!Object.prototype.hasOwnProperty.call(clinic, 'passwordPlain'), 'clinic list must not include passwordPlain');
      assert(clinic.passwordPlain == null, 'clinic list must not return stored passwords');
    }

    const usersA = await request('GET', `/dibnova-admin/clinics/${clinicIdA}/users`, {
      token: adminToken,
      expected: 200,
    });
    const usersB = await request('GET', `/dibnova-admin/clinics/${clinicIdB}/users`, {
      token: adminToken,
      expected: 200,
    });
    assert(
      usersA.data.some((u) => u.username === 'adminsec-a'),
      'clinic A users must include its doctor',
    );
    assert(
      !usersA.data.some((u) => u.username === 'adminsec-b'),
      'clinic A users must not leak clinic B users',
    );
    assert(
      usersB.data.some((u) => u.username === 'adminsec-b'),
      'clinic B users must include its doctor',
    );

    const unknownUsers = await request('GET', '/dibnova-admin/clinics/not-a-clinic/users', { token: adminToken });
    assert(unknownUsers.status >= 400, `unknown clinic users must fail (got ${unknownUsers.status})`);

    const reset = await request('POST', '/dibnova-admin/users/reset-password', {
      token: adminToken,
      body: { clinicId: clinicIdA, userId: usersA.data[0].id, newPassword: 'NewPass123' },
      expected: [200, 201],
    });
    assert(reset.data.reset === true, 'admin password reset must succeed');
    assert(!JSON.stringify(reset.data).toLowerCase().includes('newpass123'), 'reset response must not echo the password');

    const relogin = await request('POST', '/auth/login', {
      body: { username: 'adminsec-a', password: 'NewPass123' },
      expected: [200, 201],
    });
    assert(relogin.data.accessToken, 'doctor must sign in with the admin-reset password');

    const deactivateLast = await request('POST', '/dibnova-admin/users/status', {
      token: adminToken,
      body: { clinicId: clinicIdA, userId: usersA.data[0].id, isActive: false },
    });
    assert(deactivateLast.status >= 400, `last active doctor must not be deactivated (got ${deactivateLast.status})`);

    const health = await request('GET', '/dibnova-admin/ops/health', { token: adminToken, expected: 200 });
    assert(health.data.ok === true, 'admin health must be ok');
    assert(health.data.api?.ok === true, 'API health must be ok');
    assert(health.data.database?.ok === true, 'database health must be ok');
    assert(health.data.storage?.ok === true, 'storage health must be ok');
    assert(health.data.r2Configured === false, 'test env must not claim R2 is configured');
    assert(!JSON.stringify(health.data).includes(JWT_SECRET), 'health must not leak JWT secret');

    const audit = await request('GET', '/dibnova-admin/audit', { token: adminToken, expected: 200 });
    assert(Array.isArray(audit.data) && audit.data.length > 0, 'admin audit log must record actions');
    assert(
      audit.data.some((row) => row.action === 'LOGIN' || String(row.action).includes('reset-password') || String(row.action).includes('LOGIN')),
      'audit log must include login or password reset',
    );
    const auditDump = JSON.stringify(audit.data).toLowerCase();
    assert(!auditDump.includes('dibadmin-pass'), 'audit must not store admin password');
    assert(!auditDump.includes('newpass123'), 'audit must not store reset password');

    const logout = await request('POST', '/dibnova-admin/auth/logout', { token: adminToken, expected: [200, 201] });
    assert(logout.data.loggedOut === true, 'logout must succeed');
    const afterLogout = await request('GET', '/dibnova-admin/clinics', { token: adminToken });
    assert(afterLogout.status === 401, `revoked admin JWT must not work (got ${afterLogout.status})`);

    console.log('PASS: admin security');
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
