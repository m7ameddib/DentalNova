import * as fs from 'fs';
import * as path from 'path';
import yauzl from 'yauzl';

const UNSAFE_ENTRY = /(?:^|\/|\\)\.\.(?:\/|\\|$)/;

export function isUnsafeZipEntryName(fileName: string): boolean {
  const normalized = fileName.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return true;
  if (UNSAFE_ENTRY.test(normalized)) return true;
  if (normalized.includes('\0')) return true;
  return false;
}

export async function safeExtractZip(zipPath: string, destDir: string): Promise<void> {
  const destRoot = path.resolve(destDir);
  fs.mkdirSync(destRoot, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('Failed to open zip archive'));
        return;
      }

      const fail = (error: Error) => {
        try {
          zipfile.close();
        } catch {
          /* ignore */
        }
        reject(error);
      };

      zipfile.on('error', fail);
      zipfile.on('end', () => resolve());
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const name = String(entry.fileName || '').replace(/\\/g, '/');
        if (isUnsafeZipEntryName(name)) {
          fail(new Error(`Unsafe zip entry path: ${name}`));
          return;
        }

        // Skip symlink / special entries (DOS symlink bit or Unix symlink mode).
        const attr = Number(entry.externalFileAttributes || 0);
        const unixMode = (attr >>> 16) & 0xffff;
        const isSymlink = (unixMode & 0o170000) === 0o120000;
        if (isSymlink) {
          fail(new Error(`Symlink zip entries are not allowed: ${name}`));
          return;
        }

        const target = path.resolve(destRoot, name);
        if (target !== destRoot && !target.startsWith(destRoot + path.sep)) {
          fail(new Error(`Zip entry escapes destination: ${name}`));
          return;
        }

        if (/\/$/.test(name)) {
          fs.mkdirSync(target, { recursive: true });
          zipfile.readEntry();
          return;
        }

        fs.mkdirSync(path.dirname(target), { recursive: true });
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            fail(streamErr ?? new Error(`Failed to read zip entry: ${name}`));
            return;
          }
          const output = fs.createWriteStream(target, { flags: 'w' });
          readStream.on('error', fail);
          output.on('error', fail);
          output.on('finish', () => zipfile.readEntry());
          readStream.pipe(output);
        });
      });
    });
  });
}
