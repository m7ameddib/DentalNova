import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadRevokedAdminJti, saveRevokedAdminJti } from './admin-session.persist';

test('revoked admin JTIs survive a simulated process restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-admin-jti-'));
  const file = path.join(dir, 'admin-revoked-jti.json');
  const now = 2_000_000;
  const revoked = new Map([
    ['live-jti', now + 60_000],
    ['expired-jti', now - 1],
  ]);
  saveRevokedAdminJti(file, revoked, now);
  const restored = loadRevokedAdminJti(file, now);
  assert.equal(restored.get('live-jti'), now + 60_000);
  assert.equal(restored.has('expired-jti'), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('corrupt revoked-JTI file starts empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-admin-jti-'));
  const file = path.join(dir, 'admin-revoked-jti.json');
  fs.writeFileSync(file, '{nope');
  assert.equal(loadRevokedAdminJti(file).size, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
