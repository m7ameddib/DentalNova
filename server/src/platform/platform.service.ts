import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DeploymentService } from '../common/deployment.service';
import { OnlineSubscriptionStatus } from '../subscription/subscription.types';
import { ClinicUserDirectoryRow, PlatformClinic } from './platform.types';

const SUBSCRIPTION_TERM_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Online-only platform registry: clinics, global usernames, and per-clinic
 * subscriptions. Offline deployments never open this database.
 */
@Injectable()
export class PlatformService implements OnModuleInit {
  private readonly logger = new Logger(PlatformService.name);
  private platformDb: Database.Database | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly deployment: DeploymentService,
  ) {}

  onModuleInit() {
    if (!this.deployment.isOnline()) return;
    this.open();
  }

  isEnabled(): boolean {
    return this.deployment.isOnline();
  }

  platformDbPath(): string {
    return path.join(this.dataRoot(), 'platform.db');
  }

  clinicDbPath(clinicId: string): string {
    return path.join(this.dataRoot(), 'clinics', clinicId, 'clinic.db');
  }

  clinicDataDir(clinicId: string): string {
    return path.join(this.dataRoot(), 'clinics', clinicId);
  }

  defaultClinicDbPath(): string {
    const dataDir = this.config.get<string>('DNT_DATA_DIR');
    const dbFile = this.config.get<string>('DATABASE_FILE');
    if (dbFile && path.isAbsolute(dbFile)) return dbFile;
    if (dataDir) return path.join(path.resolve(dataDir), 'data', 'clinic.db');
    if (dbFile) return path.join(process.cwd(), dbFile);
    return path.join(process.cwd(), 'data', 'clinic.db');
  }

  createClinic(input: { name: string; phone?: string | null }): PlatformClinic {
    this.assertEnabled();
    const id = crypto.randomBytes(16).toString('hex');
    const dbPath = this.clinicDbPath(id);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db
      .prepare(
        `INSERT INTO clinics (id, name, phone, db_path, subscription_status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
      )
      .run(id, input.name.trim(), input.phone?.trim() || null, dbPath);
    this.logger.log(`Created online clinic ${id} (${input.name.trim()})`);
    return this.requireClinic(id);
  }

  adoptLegacyClinicIfNeeded(): void {
    if (!this.isEnabled()) return;
    if (this.listClinics().length > 0) return;

    const legacyPath = this.defaultClinicDbPath();
    if (!fs.existsSync(legacyPath)) return;

    let legacy: Database.Database | null = null;
    try {
      legacy = new Database(legacyPath, { readonly: true, fileMustExist: true });
      const row = legacy
        .prepare(
          `SELECT installation_id AS installationId, setup_completed_at AS setupCompletedAt,
                  online_subscription_status AS status, online_subscription_started_at AS startedAt,
                  online_subscription_expires_at AS expiresAt,
                  online_subscription_suspended_at AS suspendedAt,
                  online_subscription_suspended_reason AS suspendedReason,
                  online_admin_notes AS adminNotes
           FROM app_installation WHERE id = 1`,
        )
        .get() as Record<string, unknown> | undefined;
      if (!row?.setupCompletedAt) return;

      let clinicName = 'Clinic';
      try {
        const settings = legacy
          .prepare('SELECT clinic_name AS clinicName, clinic_phone AS clinicPhone FROM clinic_settings WHERE id = 1')
          .get() as { clinicName?: string; clinicPhone?: string } | undefined;
        if (settings?.clinicName?.trim()) clinicName = settings.clinicName.trim();
      } catch {
        // settings table may be missing on a broken legacy file
      }

      const id = String(row.installationId || crypto.randomBytes(16).toString('hex'));
      this.db
        .prepare(
          `INSERT INTO clinics (
            id, name, phone, db_path, subscription_status,
            subscription_started_at, subscription_expires_at,
            subscription_suspended_at, subscription_suspended_reason, admin_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          clinicName,
          null,
          legacyPath,
          (row.status as string) || 'PENDING',
          row.startedAt ?? null,
          row.expiresAt ?? null,
          row.suspendedAt ?? null,
          row.suspendedReason ?? null,
          row.adminNotes ?? null,
        );

      const users = legacy
        .prepare(
          `SELECT id, username, phone_normalized AS phoneNormalized FROM users`,
        )
        .all() as { id: number; username: string; phoneNormalized: string | null }[];
      for (const user of users) {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO clinic_user_directory (username, phone_normalized, clinic_id, user_id)
             VALUES (?, ?, ?, ?)`,
          )
          .run(user.username, user.phoneNormalized, id, user.id);
      }
      this.logger.log(`Adopted existing online clinic ${id} from ${legacyPath} (${users.length} users)`);
    } catch (err) {
      this.logger.warn(`Could not adopt legacy online clinic.db: ${(err as Error).message}`);
    } finally {
      try {
        legacy?.close();
      } catch {
        // ignore
      }
    }
  }

  listClinics(): PlatformClinic[] {
    this.assertEnabled();
    const rows = this.db.prepare('SELECT * FROM clinics ORDER BY created_at ASC').all() as Record<string, unknown>[];
    return rows.map((row) => this.mapClinic(row));
  }

  findClinic(clinicId: string): PlatformClinic | undefined {
    this.assertEnabled();
    const row = this.db.prepare('SELECT * FROM clinics WHERE id = ?').get(clinicId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapClinic(row) : undefined;
  }

  requireClinic(clinicId: string): PlatformClinic {
    const clinic = this.findClinic(clinicId);
    if (!clinic) {
      throw new Error(`Unknown clinic ${clinicId}`);
    }
    return clinic;
  }

  updateClinicProfile(clinicId: string, input: { name?: string; phone?: string | null }): void {
    this.assertEnabled();
    if (input.name?.trim()) {
      this.db.prepare('UPDATE clinics SET name = ? WHERE id = ?').run(input.name.trim(), clinicId);
    }
    if (input.phone !== undefined) {
      this.db.prepare('UPDATE clinics SET phone = ? WHERE id = ?').run(input.phone?.trim() || null, clinicId);
    }
  }

  findUserByUsername(username: string): ClinicUserDirectoryRow | undefined {
    this.assertEnabled();
    const row = this.db
      .prepare(
        `SELECT username, phone_normalized AS phoneNormalized, clinic_id AS clinicId,
                user_id AS userId, created_at AS createdAt
         FROM clinic_user_directory WHERE username = ? COLLATE NOCASE`,
      )
      .get(username.trim()) as ClinicUserDirectoryRow | undefined;
    return row;
  }

  findUserByPhone(phoneNormalized: string): ClinicUserDirectoryRow | undefined {
    this.assertEnabled();
    const row = this.db
      .prepare(
        `SELECT username, phone_normalized AS phoneNormalized, clinic_id AS clinicId,
                user_id AS userId, created_at AS createdAt
         FROM clinic_user_directory WHERE phone_normalized = ?`,
      )
      .get(phoneNormalized) as ClinicUserDirectoryRow | undefined;
    return row;
  }

  registerUser(input: {
    username: string;
    clinicId: string;
    userId: number;
    phoneNormalized?: string | null;
  }): void {
    this.assertEnabled();
    this.db
      .prepare(
        `INSERT INTO clinic_user_directory (username, phone_normalized, clinic_id, user_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.username.trim(), input.phoneNormalized || null, input.clinicId, input.userId);
  }

  getSubscription(clinicId: string) {
    const clinic = this.requireClinic(clinicId);
    let status = clinic.subscriptionStatus;
    if (status === 'ACTIVE' && clinic.subscriptionExpiresAt) {
      const expiry = new Date(clinic.subscriptionExpiresAt);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        this.db.prepare(`UPDATE clinics SET subscription_status = 'EXPIRED' WHERE id = ?`).run(clinicId);
        status = 'EXPIRED';
      }
    }
    return {
      status,
      startedAt: clinic.subscriptionStartedAt,
      expiresAt: clinic.subscriptionExpiresAt,
      suspendedAt: clinic.subscriptionSuspendedAt,
      suspendedReason: clinic.subscriptionSuspendedReason,
      adminNotes: clinic.adminNotes,
    };
  }

  canUseSystem(clinicId: string): boolean {
    return this.getSubscription(clinicId).status === 'ACTIVE';
  }

  setSubscriptionPending(clinicId: string): void {
    this.assertEnabled();
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'PENDING',
          subscription_started_at = NULL,
          subscription_expires_at = NULL,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL
         WHERE id = ?`,
      )
      .run(clinicId);
  }

  setSubscriptionActive(clinicId: string, adminNotes?: string | null): void {
    this.assertEnabled();
    const now = new Date();
    const expires = new Date(now.getTime() + SUBSCRIPTION_TERM_MS);
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'ACTIVE',
          subscription_started_at = ?,
          subscription_expires_at = ?,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL,
          admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
      )
      .run(now.toISOString(), expires.toISOString(), adminNotes ?? null, clinicId);
  }

  extendSubscription(clinicId: string, adminNotes?: string | null): void {
    const row = this.getSubscription(clinicId);
    const base = row.expiresAt ? new Date(row.expiresAt) : new Date();
    const startFrom =
      !Number.isNaN(base.getTime()) && base.getTime() > Date.now() ? base : new Date();
    const expires = new Date(startFrom.getTime() + SUBSCRIPTION_TERM_MS);
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'ACTIVE',
          subscription_expires_at = ?,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL,
          admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
      )
      .run(expires.toISOString(), adminNotes ?? null, clinicId);
  }

  setSubscriptionSuspended(clinicId: string, reason?: string | null): void {
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'SUSPENDED',
          subscription_suspended_at = datetime('now'),
          subscription_suspended_reason = ?
         WHERE id = ?`,
      )
      .run(reason?.trim() || null, clinicId);
  }

  private dataRoot(): string {
    return path.dirname(this.defaultClinicDbPath());
  }

  private open(): void {
    const file = this.platformDbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.platformDb = new Database(file);
    this.platformDb.pragma('journal_mode = WAL');
    this.platformDb.pragma('foreign_keys = ON');
    this.platformDb.pragma('busy_timeout = 5000');
    this.ensureSchema();
    this.logger.log(`Online platform registry ready at ${file}`);
    this.adoptLegacyClinicIfNeeded();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clinics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        db_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        subscription_status TEXT NOT NULL DEFAULT 'PENDING',
        subscription_started_at TEXT,
        subscription_expires_at TEXT,
        subscription_suspended_at TEXT,
        subscription_suspended_reason TEXT,
        admin_notes TEXT
      );
      CREATE TABLE IF NOT EXISTS clinic_user_directory (
        username TEXT NOT NULL COLLATE NOCASE PRIMARY KEY,
        phone_normalized TEXT UNIQUE,
        clinic_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );
    `);
  }

  private mapClinic(row: Record<string, unknown>): PlatformClinic {
    return {
      id: row.id as string,
      name: row.name as string,
      phone: (row.phone as string | null) ?? null,
      dbPath: row.db_path as string,
      createdAt: row.created_at as string,
      subscriptionStatus: row.subscription_status as OnlineSubscriptionStatus,
      subscriptionStartedAt: (row.subscription_started_at as string | null) ?? null,
      subscriptionExpiresAt: (row.subscription_expires_at as string | null) ?? null,
      subscriptionSuspendedAt: (row.subscription_suspended_at as string | null) ?? null,
      subscriptionSuspendedReason: (row.subscription_suspended_reason as string | null) ?? null,
      adminNotes: (row.admin_notes as string | null) ?? null,
    };
  }

  private get db(): Database.Database {
    if (!this.platformDb) {
      throw new Error('Online platform registry is not initialized.');
    }
    return this.platformDb;
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error('Platform clinic registry is only available in online deployment mode.');
    }
  }
}
