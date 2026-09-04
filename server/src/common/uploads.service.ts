import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  private dataRoot(): string {
    const dataDir = this.config.get<string>('DNT_DATA_DIR');
    if (dataDir) return path.resolve(dataDir);
    const dbFile = this.config.get<string>('DATABASE_FILE') || './data/clinic.db';
    const resolvedDbFile = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
    return path.dirname(resolvedDbFile);
  }

  uploadsRoot(): string {
    const sub = this.config.get<string>('DNT_DATA_DIR') ? 'attachments' : 'uploads';
    const dir = path.join(this.dataRoot(), sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  patientUploadsDir(patientId: number): string {
    const dir = path.join(this.uploadsRoot(), 'patients', String(patientId));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  clinicUploadsDir(): string {
    const dir = path.join(this.uploadsRoot(), 'clinic');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  safeFileName(originalName: string): string {
    const ext = path.extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return `${stamp}${ext}`;
  }

  resolveManagedPath(relativePath: string): string | null {
    const root = this.uploadsRoot();
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return null;
    }
    return resolved;
  }

  deleteManagedFile(relativePath: string): void {
    const absolute = this.resolveManagedPath(relativePath);
    if (absolute && fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }
  }

  deletePatientDirectory(patientId: number): void {
    const dir = path.join(this.uploadsRoot(), 'patients', String(patientId));
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
