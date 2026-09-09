import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { getTenantClinicId } from '../platform/tenant-context';
import { PlatformService } from '../platform/platform.service';

/**
 * Resolves persistent clinic data paths for production installs.
 * Program files stay separate from data under DNT_DATA_DIR (or DATABASE_FILE parent).
 */
@Injectable()
export class PathsService {
  constructor(
    private readonly config: ConfigService,
    private readonly platform: PlatformService,
  ) {}

  dataRoot(): string {
    const explicit = this.config.get<string>('DNT_DATA_DIR');
    if (explicit) return path.resolve(explicit);

    const dbFile = this.config.get<string>('DATABASE_FILE') || './data/clinic.db';
    const resolvedDb = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
    return path.dirname(resolvedDb);
  }

  dbFile(): string {
    const dataDir = this.config.get<string>('DNT_DATA_DIR');
    const explicit = this.config.get<string>('DATABASE_FILE');
    if (explicit && path.isAbsolute(explicit)) return explicit;
    // Match DatabaseService: offline launcher sets DNT_DATA_DIR; bundled .env still has ./data/clinic.db.
    if (dataDir) return path.join(path.resolve(dataDir), 'data', 'clinic.db');
    if (explicit) return path.join(process.cwd(), explicit);
    return path.join(process.cwd(), 'data', 'clinic.db');
  }

  uploadsDir(): string {
    return path.join(this.tenantDataRoot(), 'attachments');
  }

  backupsDir(): string {
    return path.join(this.tenantDataRoot(), 'backups');
  }

  logsDir(): string {
    return path.join(this.dataRoot(), 'logs');
  }

  configDir(): string {
    return path.join(this.dataRoot(), 'config');
  }

  licenseDir(): string {
    return path.join(this.dataRoot(), 'license');
  }

  jwtSecretFile(): string {
    return path.join(this.configDir(), 'jwt.secret');
  }

  downloadsDir(): string {
    return path.join(this.dataRoot(), 'downloads');
  }

  ensureDataDirs(): void {
    for (const dir of [
      path.dirname(this.dbFile()),
      this.uploadsDir(),
      this.backupsDir(),
      this.logsDir(),
      this.configDir(),
      this.licenseDir(),
      this.downloadsDir(),
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private tenantDataRoot(): string {
    const clinicId = getTenantClinicId();
    if (clinicId && this.platform.isEnabled()) {
      return this.platform.clinicDataDir(clinicId);
    }
    return this.dataRoot();
  }

  migrationsDir(): string {
    const candidates: string[] = [];
    const explicit = this.config.get<string>('MIGRATIONS_DIR');
    if (explicit) {
      candidates.push(path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit));
    }
    candidates.push(path.join(process.cwd(), 'database', 'migrations'));
    candidates.push(path.join(process.cwd(), '..', 'database', 'migrations'));
    const found = candidates.find((dir) => fs.existsSync(dir));
    return found ?? candidates[0];
  }

  readJwtSecret(): string | null {
    const file = this.jwtSecretFile();
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf-8').trim() || null;
  }

  writeJwtSecret(secret: string): void {
    fs.mkdirSync(this.configDir(), { recursive: true });
    fs.writeFileSync(this.jwtSecretFile(), secret, { encoding: 'utf-8', mode: 0o600 });
  }
}
