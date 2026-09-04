import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ensureRolesAndPermissions, seedReferenceData } from './reference-seed';
import { seedComprehensiveTreatmentCatalog } from './seed-comprehensive-catalog';

/**
 * Owns the single SQLite connection (persistence layer) and applies SQL
 * migrations on startup. This is the ONLY place in the app that talks to
 * `better-sqlite3` directly — everything else goes through repositories.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db!: Database.Database;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.openConnection();
  }

  onModuleDestroy() {
    this.closeConnection();
  }

  get connection(): Database.Database {
    return this.db;
  }

  getDbPath(): string {
    return this.resolveDbPath();
  }

  /** Consistent snapshot backup while the clinic is running (WAL-safe). */
  async backupToFile(destPath: string): Promise<void> {
    await this.db.backup(destPath);
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
    const dbFile = this.resolveDbPath();
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });

    this.db = new Database(dbFile);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.runMigrations();
    this.ensureReferenceData();
    seedComprehensiveTreatmentCatalog(this.db);
    this.logger.log(`SQLite database ready at ${dbFile}`);
  }

  private closeConnection() {
    if (!this.db) return;
    try {
      // Merge the WAL back into the main file and truncate it so no stale
      // WAL/SHM data is left behind that could shadow a restored database.
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
      this.logger.warn(`WAL checkpoint before close failed: ${(err as Error).message}`);
    }
    this.db.close();
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
    const explicit = this.config.get<string>('MIGRATIONS_DIR');
    if (explicit) {
      return path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit);
    }
    const packaged = path.join(process.cwd(), 'database', 'migrations');
    if (fs.existsSync(packaged)) return packaged;
    return path.join(process.cwd(), '..', 'database', 'migrations');
  }

  private runMigrations() {
    this.db.exec(
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
      (this.db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(
        (r) => r.name,
      ),
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      this.logger.log(`Applying migration ${file}`);
      const apply = this.db.transaction(() => {
        this.db.exec(sql);
        this.db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      });
      try {
        apply();
      } catch (err) {
        this.logger.error(`Migration ${file} failed`, err as Error);
        throw err;
      }
    }
  }

  private ensureReferenceData() {
    const roleCount = (
      this.db.prepare('SELECT COUNT(*) AS c FROM roles').get() as { c: number }
    ).c;
    if (roleCount === 0) {
      this.logger.log('Seeding reference data (roles, permissions, treatment catalog)...');
      seedReferenceData(this.db);
      return;
    }
    // Existing clinic (Update or reinstall): still grant any new default
    // permissions (e.g. ai.assistant.use) that were added after first setup.
    ensureRolesAndPermissions(this.db);
  }
}
