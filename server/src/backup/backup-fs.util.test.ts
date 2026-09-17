import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { replaceDirectoryAtomically, replaceFileAtomically } from './backup-fs.util';

test('replaceFileAtomically overwrites dest without leaving a temp sibling', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-bak-file-'));
  const src = path.join(dir, 'src.db');
  const dest = path.join(dir, 'clinic.db');
  fs.writeFileSync(src, 'restored-db');
  fs.writeFileSync(dest, 'old-db');
  replaceFileAtomically(src, dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'restored-db');
  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('restore-tmp'));
  assert.deepEqual(leftovers, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('replaceDirectoryAtomically swaps dest and removes the previous copy', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-bak-dir-'));
  const src = path.join(dir, 'uploads-src');
  const dest = path.join(dir, 'uploads');
  fs.mkdirSync(src);
  fs.mkdirSync(dest);
  fs.writeFileSync(path.join(src, 'new.txt'), 'new');
  fs.writeFileSync(path.join(dest, 'old.txt'), 'old');
  await replaceDirectoryAtomically(src, dest);
  assert.equal(fs.readFileSync(path.join(dest, 'new.txt'), 'utf8'), 'new');
  assert.equal(fs.existsSync(path.join(dest, 'old.txt')), false);
  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('pre-restore') || name.includes('restore-tmp'));
  assert.deepEqual(leftovers, []);
  fs.rmSync(dir, { recursive: true, force: true });
});
