import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ensureRolesAndPermissions, seedReferenceData } from './reference-seed';
import { seedComprehensiveTreatmentCatalog } from './seed-comprehensive-catalog';
import { getTenantClinicId } from '../platform/tenant-context';
import { PlatformService } from '../platform/platform.service';

/**
 * Owns the single SQLite connection (persistence layer) and applies SQL
 * migrations on startup. This is the ONLY place in the app that talks to
 * `better-sqlite3` directly — everything else goes through repositories.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db!: Database.Database;
  private readonly clinicConnections = new Map<string, Database.Database>();

  constructor(
    private readonly config: ConfigService,
    private readonly platform: PlatformService,
  ) {}

  onModuleInit() {
    this.openConnection();
  }

  onModuleDestroy() {
    for (const clinicId of [...this.clinicConnections.keys()]) {
      this.closeClinicConnection(clinicId);
    }
    this.closeConnection();
  }

  get connection(): Database.Database {
    const clinicId = getTenantClinicId();
    if (clinicId && this.platform.isEnabled()) {
      return this.ensureClinicConnection(clinicId);
    }
    // Online without tenant context must not use another clinic's file.
    // The default clinic.db is only for offline / pre-tenant platform work.
    return this.db;
  }

  getDbPath(): string {
    const clinicId = getTenantClinicId();
    if (clinicId && this.platform.isEnabled()) {
      return this.platform.requireClinic(clinicId).dbPath;
    }
    return this.resolveDbPath();
  }

  ensureClinicFile(dbFile: string): Database.Database {
    return this.openDatabaseFile(dbFile);
  }

  ensureClinicConnection(clinicId: string): Database.Database {
    const existing = this.clinicConnections.get(clinicId);
    if (existing) return existing;
    const clinic = this.platform.requireClinic(clinicId);
    const opened = this.openDatabaseFile(clinic.dbPath);
    this.clinicConnections.set(clinicId, opened);
    return opened;
  }

  /** Consistent snapshot backup while the clinic is running (WAL-safe). */
  async backupToFile(destPath: string): Promise<void> {
    await this.connection.backup(destPath);
  }

  /**
   * Runs `fn` while the live connection is closed, then always reopens a
   * fresh connection afterwards (even if `fn` throws). This is used to
   * safely replace the database file on disk — e.g. during backup restore —
   * without leaving the server without a working connection, and without
   * requiring a full application restart. Because repositories always read
   * the connection via the `connection` getter (never cache it), they pick
   * up the reopened connection automatically.
   */
  async withConnectionClosed<T>(fn: () => Promise<T> | T): Promise<T> {
    const clinicId = getTenantClinicId();
    if (clinicId && this.platform.isEnabled()) {
      this.closeClinicConnection(clinicId);
      let result: T;
      try {
        result = await fn();
      } catch (err) {
        try {
          this.ensureClinicConnection(clinicId);
        } catch (reopenErr) {
          this.logger.error(
            'Failed to reopen tenant database connection after a failed operation',
            reopenErr as Error,
          );
        }
        throw err;
      }
      try {
        this.ensureClinicConnection(clinicId);
      } catch (reopenErr) {
        this.logger.error(
          'Tenant database operation succeeded, but reopening the connection afterwards failed. A restart may be required.',
          reopenErr as Error,
        );
      }
      return result;
    }

    this.closeConnection();

    let result: T;
    try {
      result = await fn();
    } catch (err) {
      try {
        this.openConnection();
      } catch (reopenErr) {
        this.logger.error(
          'Failed to reopen database connection after a failed operation',
          reopenErr as Error,
        );
      }
      throw err;
    }

    // `fn` already succeeded at this point (e.g. the backup file was
    // swapped in during a restore). A failure here means only that
    // reopening the connection — or re-running migrations/seed data on
    // it — ran into trouble; it must NOT be reported as if `fn` itself
    // had failed, otherwise callers (e.g. restore) would tell the user
    // the operation failed when it actually succeeded.
    try {
      this.openConnection();
    } catch (reopenErr) {
      this.logger.error(
        'Database operation succeeded, but reopening the connection afterwards failed. A restart may be required.',
        reopenErr as Error,
      );
    }

    return result;
  }

  private openConnection() {
    this.db = this.openDatabaseFile(this.resolveDbPath());
  }

  private openDatabaseFile(dbFile: string): Database.Database {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    const db = new Database(dbFile);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    this.runMigrationsOn(db);
    this.ensureReferenceDataOn(db);
    seedComprehensiveTreatmentCatalog(db);
    this.logger.log(`SQLite database ready at ${dbFile}`);
    return db;
  }

  private closeClinicConnection(clinicId: string) {
    const db = this.clinicConnections.get(clinicId);
    if (!db) return;
    this.closeDb(db);
    this.clinicConnections.delete(clinicId);
  }

  private closeConnection() {
    if (!this.db) return;
    this.closeDb(this.db);
  }

  private closeDb(db: Database.Database) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
      this.logger.warn(`WAL checkpoint before close failed: ${(err as Error).message}`);
    }
    db.close();
  }

  private resolveDbPath(): string {
    const dataDir = this.config.get<string>('DNT_DATA_DIR');
    const dbFile = this.config.get<string>('DATABASE_FILE');
    if (dbFile && path.isAbsolute(dbFile)) return dbFile;
    if (dataDir) return path.join(path.resolve(dataDir), 'data', 'clinic.db');
    if (dbFile) return path.join(process.cwd(), dbFile);
    return path.join(process.cwd(), 'data', 'clinic.db');
  }

  private migrationsDir(): string {
    const candidates: string[] = [];
    const explicit = this.config.get<string>('MIGRATIONS_DIR');
    if (explicit) {
      candidates.push(path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit));
    }
    candidates.push(path.join(process.cwd(), 'database', 'migrations'));
    candidates.push(path.join(process.cwd(), '..', 'database', 'migrations'));
    candidates.push(path.join(__dirname, '..', '..', 'database', 'migrations'));
    const found = candidates.find((dir) => fs.existsSync(dir));
    return found ?? candidates[0];
  }

  private runMigrationsOn(db: Database.Database) {
    db.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    );

    const migrationsDir = this.migrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      this.logger.warn(`No migrations directory found at ${migrationsDir}`);
      return;
    }

    const applied = new Set(
      (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      this.logger.log(`Applying migration ${file}`);
      const apply = db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      });
      try {
        apply();
      } catch (err) {
        this.logger.error(`Migration ${file} failed`, err as Error);
        throw err;
      }
    }
  }

  private ensureReferenceDataOn(db: Database.Database) {
    const roleCount = (db.prepare('SELECT COUNT(*) AS c FROM roles').get() as { c: number }).c;
    if (roleCount === 0) {
      this.logger.log('Seeding reference data (roles, permissions, treatment catalog)...');
      seedReferenceData(db);
      return;
    }
    // Existing clinic (Update or reinstall): still grant any new default
    // permissions (e.g. ai.assistant.use) that were added after first setup.
    ensureRolesAndPermissions(db);
  }
}
