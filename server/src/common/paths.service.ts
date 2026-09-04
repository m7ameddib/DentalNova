import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves persistent clinic data paths for production installs.
 * Program files stay separate from data under DNT_DATA_DIR (or DATABASE_FILE parent).
 */
@Injectable()
export class PathsService {
  constructor(private readonly config: ConfigService) {}

  dataRoot(): string {
    const explicit = this.config.get<string>('DNT_DATA_DIR');
    if (explicit) return path.resolve(explicit);

    const dbFile = this.config.get<string>('DATABASE_FILE') || './data/clinic.db';
    const resolvedDb = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
    return path.dirname(resolvedDb);
  }

  dbFile(): string {
    const explicit = this.config.get<string>('DATABASE_FILE');
    if (explicit && path.isAbsolute(explicit)) return explicit;
    if (explicit) return path.join(process.cwd(), explicit);
    return path.join(this.dataRoot(), 'data', 'clinic.db');
  }

  uploadsDir(): string {
    return path.join(this.dataRoot(), 'attachments');
  }

  backupsDir(): string {
    return path.join(this.dataRoot(), 'backups');
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

  ensureDataDirs(): void {
    for (const dir of [
      path.dirname(this.dbFile()),
      this.uploadsDir(),
      this.backupsDir(),
      this.logsDir(),
      this.configDir(),
      this.licenseDir(),
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  migrationsDir(): string {
    const explicit = this.config.get<string>('MIGRATIONS_DIR');
    if (explicit) {
      return path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit);
    }
    const packaged = path.join(process.cwd(), 'database', 'migrations');
    if (fs.existsSync(packaged)) return packaged;
    return path.join(process.cwd(), '..', 'database', 'migrations');
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
