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
    this.logEvent(clinicId, 'SUSPEND', reason ?? '');
  }

  setSubscriptionExpiresAt(
    clinicId: string,
    expiresAt: string,
    adminNotes?: string | null,
    activate = true,
  ): void {
    this.assertEnabled();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = CASE WHEN ? THEN 'ACTIVE' ELSE subscription_status END,
          subscription_started_at = COALESCE(subscription_started_at, ?),
          subscription_expires_at = ?,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL,
          admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
      )
      .run(activate ? 1 : 0, now, expiresAt, adminNotes ?? null, clinicId);
    this.logEvent(clinicId, activate ? 'RENEW' : 'SET_EXPIRY', expiresAt);
  }

  setSubscriptionCancelled(clinicId: string, reason?: string | null): void {
    this.assertEnabled();
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'CANCELLED',
          subscription_suspended_at = datetime('now'),
          subscription_suspended_reason = ?,
          admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
      )
      .run(reason?.trim() || null, reason ?? null, clinicId);
    this.logEvent(clinicId, 'CANCEL', reason ?? '');
  }

  /** Remove clinic from the admin directory only. Never deletes clinic.db. */
  removeClinicRecord(clinicId: string): void {
    this.assertEnabled();
    this.requireClinic(clinicId);
    this.logEvent(clinicId, 'DELETE_DIRECTORY', 'Clinic directory record removed; clinic.db kept');
    this.db.prepare('DELETE FROM clinic_user_directory WHERE clinic_id = ?').run(clinicId);
    this.db.prepare('DELETE FROM clinic_recovery WHERE clinic_id = ?').run(clinicId);
    this.db.prepare('DELETE FROM clinics WHERE id = ?').run(clinicId);
  }

  logEvent(clinicId: string | null, eventType: string, details?: string | null): void {
    if (!this.isEnabled()) return;
    this.db
      .prepare('INSERT INTO license_events (clinic_id, event_type, details) VALUES (?, ?, ?)')
      .run(clinicId, eventType, details ?? null);
  }

  listEvents(clinicId?: string) {
    this.assertEnabled();
    const rows = clinicId
      ? this.db
          .prepare('SELECT * FROM license_events WHERE clinic_id = ? ORDER BY id DESC LIMIT 100')
          .all(clinicId)
      : this.db.prepare('SELECT * FROM license_events ORDER BY id DESC LIMIT 100').all();
    return rows as Record<string, unknown>[];
  }

  listPayments(clinicId?: string) {
    this.assertEnabled();
    const rows = clinicId
      ? this.db
          .prepare('SELECT * FROM license_payments WHERE clinic_id = ? ORDER BY id DESC')
          .all(clinicId)
      : this.db.prepare('SELECT * FROM license_payments ORDER BY id DESC').all();
    return (rows as Record<string, unknown>[]).map((row) => this.mapPayment(row));
  }

  addPayment(input: {
    clinicId: string;
    amountCents: number;
    paymentDate: string;
    method: string;
    note?: string | null;
  }) {
    this.assertEnabled();
    const result = this.db
      .prepare(
        `INSERT INTO license_payments (clinic_id, amount_cents, payment_date, method, note)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.clinicId, input.amountCents, input.paymentDate, input.method, input.note ?? null);
    this.logEvent(input.clinicId, 'PAYMENT', `${input.amountCents} ${input.method}`);
    return this.getPayment(Number(result.lastInsertRowid));
  }

  updatePayment(
    id: number,
    input: { amountCents?: number; paymentDate?: string; method?: string; note?: string | null },
  ) {
    this.assertEnabled();
    const existing = this.getPayment(id);
    if (!existing || existing.status === 'VOID') {
      throw new Error('Payment not found or already voided.');
    }
    this.db
      .prepare(
        `UPDATE license_payments SET
          amount_cents = ?, payment_date = ?, method = ?, note = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.amountCents ?? existing.amountCents,
        input.paymentDate ?? existing.paymentDate,
        input.method ?? existing.method,
        input.note ?? existing.note,
        id,
      );
    this.logEvent(existing.clinicId, 'PAYMENT_EDIT', String(id));
    return this.getPayment(id);
  }

  voidPayment(id: number, reason?: string | null) {
    this.assertEnabled();
    const existing = this.getPayment(id);
    if (!existing || existing.status === 'VOID') {
      throw new Error('Payment not found or already voided.');
    }
    this.db
      .prepare(
        `UPDATE license_payments SET status = 'VOID', void_reason = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(reason?.trim() || null, id);
    this.logEvent(existing.clinicId, 'PAYMENT_VOID', reason ?? '');
    return this.getPayment(id);
  }

  getPayment(id: number) {
    const row = this.db.prepare('SELECT * FROM license_payments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapPayment(row) : null;
  }

  paymentBalanceCents(clinicId: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN amount_cents ELSE 0 END), 0) AS c
         FROM license_payments WHERE clinic_id = ?`,
      )
      .get(clinicId) as { c: number };
    return Number(row?.c ?? 0);
  }

  getRecoveryHash(clinicId: string): string | null {
    const row = this.db
      .prepare('SELECT recovery_code_hash FROM clinic_recovery WHERE clinic_id = ?')
      .get(clinicId) as { recovery_code_hash?: string } | undefined;
    return row?.recovery_code_hash ?? null;
  }

  setRecoveryHash(clinicId: string, hash: string): void {
    this.db
      .prepare(
        `INSERT INTO clinic_recovery (clinic_id, recovery_code_hash, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(clinic_id) DO UPDATE SET recovery_code_hash = excluded.recovery_code_hash, updated_at = datetime('now')`,
      )
      .run(clinicId, hash);
    this.logEvent(clinicId, 'RECOVERY_CODE', 'Recovery code rotated');
  }

  listClinicUsers(clinicId: string) {
    const clinic = this.requireClinic(clinicId);
    if (!fs.existsSync(clinic.dbPath)) return [];
    const clinicDb = new Database(clinic.dbPath, { readonly: true, fileMustExist: true });
    try {
      const rows = clinicDb
        .prepare(
          `SELECT u.id, u.full_name, u.username, u.is_active, u.phone, r.name AS role_name, r.label AS role_label
           FROM users u LEFT JOIN roles r ON r.id = u.role_id
           ORDER BY u.full_name`,
        )
        .all() as Record<string, unknown>[];
      return rows.map((row) => ({
        id: Number(row.id),
        fullName: String(row.full_name ?? ''),
        username: String(row.username ?? ''),
        isActive: Boolean(row.is_active),
        phone: (row.phone as string | null) ?? null,
        roleName: (row.role_name as string | null) ?? null,
        roleLabel: (row.role_label as string | null) ?? null,
      }));
    } finally {
      clinicDb.close();
    }
  }

  updateClinicUserPassword(clinicId: string, userId: number, passwordHash: string): void {
    const clinic = this.requireClinic(clinicId);
    const clinicDb = new Database(clinic.dbPath, { fileMustExist: true });
    try {
      const result = clinicDb
        .prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(passwordHash, userId);
      if (result.changes === 0) throw new Error('User not found');
    } finally {
      clinicDb.close();
    }
    this.logEvent(clinicId, 'PASSWORD_RESET', `user ${userId}`);
  }

  findUsersByPhone(phoneNormalized: string): { clinicId: string; username: string }[] {
    return (
      this.db
        .prepare(
          `SELECT clinic_id AS clinicId, username FROM clinic_user_directory WHERE phone_normalized = ?`,
        )
        .all(phoneNormalized) as { clinicId: string; username: string }[]
    );
  }

  private mapPayment(row: Record<string, unknown>) {
    return {
      id: Number(row.id),
      clinicId: String(row.clinic_id ?? ''),
      amountCents: Number(row.amount_cents ?? 0),
      paymentDate: String(row.payment_date ?? ''),
      method: String(row.method ?? ''),
      note: (row.note as string | null) ?? null,
      status: String(row.status ?? 'ACTIVE'),
      voidReason: (row.void_reason as string | null) ?? null,
      createdAt: String(row.created_at ?? ''),
    };
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
      CREATE TABLE IF NOT EXISTS license_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS license_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id TEXT,
        amount_cents INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        method TEXT NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        void_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS clinic_recovery (
        clinic_id TEXT PRIMARY KEY,
        recovery_code_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
