import * as fs from 'fs';
import * as path from 'path';

export async function copyDirRecursive(src: string, dest: string): Promise<void> {
  if (!fs.existsSync(src)) return;
  await fs.promises.mkdir(dest, { recursive: true });
  for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
    } else {
      await fs.promises.copyFile(from, to);
    }
  }
}

/** Copy `src` over `dest` via a sibling temp file so a crash cannot truncate dest mid-write. */
export function replaceFileAtomically(src: string, dest: string): void {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(dest)}.restore-tmp-${process.pid}-${Date.now()}`);
  fs.copyFileSync(src, tmp);
  try {
    try {
      fs.renameSync(tmp, dest);
    } catch {
      if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
      fs.renameSync(tmp, dest);
    }
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/**
 * Replace `dest` with a copy of `src`. Keeps the previous dest as a sibling
 * backup until the swap succeeds, then removes it.
 */
export async function replaceDirectoryAtomically(src: string, dest: string): Promise<void> {
  const tmp = `${dest}.restore-tmp-${process.pid}`;
  const bak = `${dest}.pre-restore-${process.pid}`;
  await fs.promises.rm(tmp, { recursive: true, force: true });
  await copyDirRecursive(src, tmp);
  if (fs.existsSync(dest)) {
    await fs.promises.rm(bak, { recursive: true, force: true });
    await fs.promises.rename(dest, bak);
  }
  try {
    await fs.promises.rename(tmp, dest);
  } catch (err) {
    if (fs.existsSync(bak)) {
      await fs.promises.rm(dest, { recursive: true, force: true }).catch(() => undefined);
      await fs.promises.rename(bak, dest);
    }
    await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
  await fs.promises.rm(bak, { recursive: true, force: true });
}
