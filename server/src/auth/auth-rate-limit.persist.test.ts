import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadRateLimitWindows, saveRateLimitWindows } from './auth-rate-limit.persist';

test('rate-limit windows survive a simulated process restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-rl-'));
  const file = path.join(dir, 'auth-rate-limit.json');
  const now = 1_000_000;
  const windows = new Map([
    ['login:1.2.3.4:admin', { count: 7, resetAt: now + 60_000 }],
    ['expired', { count: 9, resetAt: now - 1 }],
  ]);
  saveRateLimitWindows(file, windows, now);
  const restored = loadRateLimitWindows(file, now);
  assert.equal(restored.get('login:1.2.3.4:admin')?.count, 7);
  assert.equal(restored.has('expired'), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('corrupt persist file does not throw and starts empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-rl-'));
  const file = path.join(dir, 'auth-rate-limit.json');
  fs.writeFileSync(file, '{not-json');
  const restored = loadRateLimitWindows(file);
  assert.equal(restored.size, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
