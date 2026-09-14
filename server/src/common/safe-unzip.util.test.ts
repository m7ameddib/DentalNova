import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { isUnsafeZipEntryName, safeExtractZip } from './safe-unzip.util';

function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function zipWithStoredEntry(fileName: string, contents: string): Buffer {
  const name = Buffer.from(fileName);
  const data = Buffer.from(contents);
  const crc = zlib.crc32(data);
  const local = Buffer.concat([
    Buffer.from('PK\x03\x04'),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    name,
    data,
  ]);
  const central = Buffer.concat([
    Buffer.from('PK\x01\x02'),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    name,
  ]);
  const eocd = Buffer.concat([
    Buffer.from('PK\x05\x06'),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(central.length),
    u32(local.length),
    u16(0),
  ]);
  return Buffer.concat([local, central, eocd]);
}

test('rejects path traversal and absolute zip names', () => {
  assert.equal(isUnsafeZipEntryName('../clinic.db'), true);
  assert.equal(isUnsafeZipEntryName('/etc/passwd'), true);
  assert.equal(isUnsafeZipEntryName('C:/Windows/clinic.db'), true);
  assert.equal(isUnsafeZipEntryName('manifest.json'), false);
  assert.equal(isUnsafeZipEntryName('uploads/patients/1/x.png'), false);
});

test('safeExtractZip writes only inside destination', async () => {
  const zipfile = path.join(os.tmpdir(), `dn-unzip-${Date.now()}.zip`);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-unzip-dest-'));
  fs.writeFileSync(zipfile, zipWithStoredEntry('../evil.txt', 'nope'));
  await assert.rejects(() => safeExtractZip(zipfile, dest), /Unsafe zip entry|escapes destination|invalid relative path/);
  assert.equal(fs.existsSync(path.join(dest, 'evil.txt')), false);
  const parentEvil = path.resolve(dest, '../evil.txt');
  if (fs.existsSync(parentEvil) && parentEvil.startsWith(os.tmpdir())) {
    fs.rmSync(parentEvil, { force: true });
    throw new Error('zip path escaped destination');
  }
  fs.rmSync(zipfile, { force: true });
  fs.rmSync(dest, { recursive: true, force: true });
});
