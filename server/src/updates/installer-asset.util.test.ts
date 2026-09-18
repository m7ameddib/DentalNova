import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedInstallerFileName, findInstallerAsset } from './installer-asset.util';

test('installer asset must match the release tag exactly', () => {
  const assets = [
    { name: 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe' },
    { name: 'DNT-Dental-Main-Clinic-Setup-v1.1.18.exe.sha256' },
    { name: 'notes.txt' },
  ];
  assert.equal(expectedInstallerFileName('v1.1.18'), 'DNT-Dental-Main-Clinic-Setup-v1.1.18.exe');
  assert.equal(findInstallerAsset(assets, 'v1.1.18'), null);
  assert.equal(findInstallerAsset(assets, 'v1.1.17')?.name, 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe');
});
