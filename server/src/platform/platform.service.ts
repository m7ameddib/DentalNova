import { Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DeploymentService } from '../common/deployment.service';
import {
  ClinicTrialType,
  isSubscriptionUsable,
  OnlineSubscriptionStatus,
  TRIAL_DURATION_DAYS,
} from '../subscription/subscription.types';
import { ClinicUserDirectoryRow, ClinicTrialAccount, PlatformClinic } from './platform.types';
import { consumeHashedOneTimeRow } from './one-time-token.util';

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

  createClinic(input: {
    name: string;
    phone?: string | null;
    trialType?: ClinicTrialType | null;
    doctorName?: string | null;
    status?: OnlineSubscriptionStatus;
  }): PlatformClinic {
    this.assertEnabled();
    const id = crypto.randomBytes(16).toString('hex');
    const dbPath = this.clinicDbPath(id);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const status = input.status ?? (input.trialType ? 'TRIAL_PENDING' : 'PENDING');
    this.db
      .prepare(
        `INSERT INTO clinics (id, name, phone, db_path, subscription_status, trial_type, doctor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name.trim(),
        input.phone?.trim() || null,
        dbPath,
        status,
        input.trialType ?? null,
        input.doctorName?.trim() || null,
      );
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
      throw new NotFoundException('Unknown clinic');
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
    if ((status === 'ACTIVE' || status === 'TRIAL_ACTIVE') && clinic.subscriptionExpiresAt) {
      const expiry = new Date(clinic.subscriptionExpiresAt);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        status = status === 'TRIAL_ACTIVE' ? 'TRIAL_EXPIRED' : 'EXPIRED';
        this.db.prepare(`UPDATE clinics SET subscription_status = ? WHERE id = ?`).run(status, clinicId);
      }
    }
    return {
      status,
      startedAt: clinic.subscriptionStartedAt,
      expiresAt: clinic.subscriptionExpiresAt,
      suspendedAt: clinic.subscriptionSuspendedAt,
      suspendedReason: clinic.subscriptionSuspendedReason,
      adminNotes: clinic.adminNotes,
      trialType: clinic.trialType,
      doctorName: clinic.doctorName,
    };
  }

  canUseSystem(clinicId: string): boolean {
    return isSubscriptionUsable(this.getSubscription(clinicId).status);
  }

  setSubscriptionPending(clinicId: string, status: 'PENDING' | 'TRIAL_PENDING' = 'PENDING'): void {
    this.assertEnabled();
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = ?,
          subscription_started_at = NULL,
          subscription_expires_at = NULL,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL
         WHERE id = ?`,
      )
      .run(status, clinicId);
  }

  activateTrial(clinicId: string, adminNotes?: string | null): void {
    this.assertEnabled();
    const now = new Date();
    const expires = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    this.db
      .prepare(
        `UPDATE clinics SET
          subscription_status = 'TRIAL_ACTIVE',
          subscription_started_at = ?,
          subscription_expires_at = ?,
          subscription_suspended_at = NULL,
          subscription_suspended_reason = NULL,
          admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
      )
      .run(now.toISOString(), expires.toISOString(), adminNotes ?? '7-day free trial', clinicId);
    this.logEvent(clinicId, 'TRIAL_ACTIVATE', expires.toISOString());
  }

  upsertTrialAccount(input: {
    clinicId: string;
    trialType: ClinicTrialType;
    doctorName?: string | null;
    username?: string | null;
    passwordPlain?: string | null;
  }): void {
    this.assertEnabled();
    const storedSecret = input.passwordPlain ? this.encryptSecret(input.passwordPlain) : null;
    this.db
      .prepare(
        `INSERT INTO clinic_trial_accounts (clinic_id, trial_type, doctor_name, username, password_plain)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(clinic_id) DO UPDATE SET
           trial_type = excluded.trial_type,
           doctor_name = COALESCE(excluded.doctor_name, clinic_trial_accounts.doctor_name),
           username = COALESCE(excluded.username, clinic_trial_accounts.username),
           password_plain = COALESCE(excluded.password_plain, clinic_trial_accounts.password_plain)`,
      )
      .run(
        input.clinicId,
        input.trialType,
        input.doctorName?.trim() || null,
        input.username?.trim() || null,
        storedSecret,
      );
  }

  getTrialAccount(clinicId: string): ClinicTrialAccount | null {
    this.assertEnabled();
    const row = this.db
      .prepare('SELECT * FROM clinic_trial_accounts WHERE clinic_id = ?')
      .get(clinicId) as Record<string, unknown> | undefined;
    return row ? this.mapTrialAccount(row) : null;
  }

  listClinicUsernames(clinicId: string): string[] {
    this.assertEnabled();
    const rows = this.db
      .prepare(`SELECT username FROM clinic_user_directory WHERE clinic_id = ? ORDER BY created_at ASC`)
      .all(clinicId) as { username: string }[];
    return rows.map((row) => row.username);
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
    this.db.prepare('DELETE FROM clinic_trial_accounts WHERE clinic_id = ?').run(clinicId);
    this.db.prepare('DELETE FROM sync_registered_devices WHERE clinic_id = ?').run(clinicId);
    this.db.prepare('DELETE FROM sync_pairing_codes WHERE clinic_id = ?').run(clinicId);
    this.db.prepare('DELETE FROM clinics WHERE id = ?').run(clinicId);
  }

  logEvent(clinicId: string | null, eventType: string, details?: string | null): void {
    if (!this.isEnabled()) return;
    this.db
      .prepare('INSERT INTO license_events (clinic_id, event_type, details) VALUES (?, ?, ?)')
      .run(clinicId, eventType, details ?? null);
  }

  recordAdminAudit(input: {
    actor: string;
    action: string;
    clinicId?: string | null;
    target?: string | null;
    details?: string | null;
    ip?: string | null;
  }): void {
    if (!this.isEnabled()) {
      this.logger.log(`admin-audit ${input.action} actor=${input.actor}`);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO admin_audit_events (actor, action, clinic_id, target, details, ip)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.actor.slice(0, 120),
        input.action.slice(0, 160),
        input.clinicId ?? null,
        input.target ?? null,
        input.details ?? null,
        input.ip ?? null,
      );
  }

  listAdminAudit(clinicId?: string, limit = 100) {
    if (!this.isEnabled()) return [];
    const cap = Math.min(Math.max(limit, 1), 200);
    const rows = clinicId
      ? this.db
          .prepare(
            `SELECT id, actor, action, clinic_id AS clinicId, target, details, ip, created_at AS createdAt
             FROM admin_audit_events WHERE clinic_id = ? ORDER BY id DESC LIMIT ?`,
          )
          .all(clinicId, cap)
      : this.db
          .prepare(
            `SELECT id, actor, action, clinic_id AS clinicId, target, details, ip, created_at AS createdAt
             FROM admin_audit_events ORDER BY id DESC LIMIT ?`,
          )
          .all(cap);
    return rows as Array<{
      id: number;
      actor: string;
      action: string;
      clinicId: string | null;
      target: string | null;
      details: string | null;
      ip: string | null;
      createdAt: string;
    }>;
  }

  ping(): boolean {
    if (!this.isEnabled()) return false;
    this.db.prepare('SELECT 1 AS ok').get();
    return true;
  }

  syncSummary() {
    if (!this.isEnabled()) return { registeredDevices: 0, activeDevices: 0 };
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS registered,
                COALESCE(SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END), 0) AS active
         FROM sync_registered_devices`,
      )
      .get() as { registered: number; active: number };
    return {
      registeredDevices: Number(row?.registered ?? 0),
      activeDevices: Number(row?.active ?? 0),
    };
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
      throw new NotFoundException('Payment not found or already voided.');
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
      throw new NotFoundException('Payment not found or already voided.');
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
      if (result.changes === 0) throw new NotFoundException('User not found');
    } finally {
      clinicDb.close();
    }
    this.logEvent(clinicId, 'PASSWORD_RESET', `user ${userId}`);
  }

  setClinicUserActive(clinicId: string, userId: number, isActive: boolean): { id: number; isActive: boolean } {
    const clinic = this.requireClinic(clinicId);
    const clinicDb = new Database(clinic.dbPath, { fileMustExist: true });
    try {
      const user = clinicDb
        .prepare(
          `SELECT u.id, u.is_active AS isActive, r.name AS roleName
           FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
        )
        .get(userId) as { id: number; isActive: number; roleName?: string } | undefined;
      if (!user) throw new NotFoundException('User not found');
      if (!isActive && user.roleName === 'doctor') {
        const remaining = clinicDb
          .prepare(
            `SELECT COUNT(*) AS c FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'doctor' AND u.is_active = 1 AND u.id != ?`,
          )
          .get(userId) as { c: number };
        if (Number(remaining?.c ?? 0) < 1) {
          throw new BadRequestException('Cannot deactivate the last active doctor for this clinic.');
        }
      }
      clinicDb.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(isActive ? 1 : 0, userId);
    } finally {
      clinicDb.close();
    }
    this.logEvent(clinicId, isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', `user ${userId}`);
    return { id: userId, isActive };
  }

  setClinicUserRole(clinicId: string, userId: number, roleName: 'doctor' | 'employee') {
    const clinic = this.requireClinic(clinicId);
    const clinicDb = new Database(clinic.dbPath, { fileMustExist: true });
    try {
      const role = clinicDb.prepare(`SELECT id FROM roles WHERE name = ?`).get(roleName) as { id: number } | undefined;
      if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
      const existing = clinicDb
        .prepare(
          `SELECT u.id, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
        )
        .get(userId) as { id: number; roleName?: string } | undefined;
      if (!existing) throw new NotFoundException('User not found');
      if (existing.roleName === 'doctor' && roleName !== 'doctor') {
        const remaining = clinicDb
          .prepare(
            `SELECT COUNT(*) AS c FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'doctor' AND u.is_active = 1 AND u.id != ?`,
          )
          .get(userId) as { c: number };
        if (Number(remaining?.c ?? 0) < 1) {
          throw new BadRequestException('Cannot change the last active doctor role.');
        }
      }
      const result = clinicDb
        .prepare(`UPDATE users SET role_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(role.id, userId);
      if (result.changes === 0) throw new NotFoundException('User not found');
    } finally {
      clinicDb.close();
    }
    this.logEvent(clinicId, 'USER_ROLE', `user ${userId} -> ${roleName}`);
    return { id: userId, roleName };
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
    this.platformDb.pragma('busy_timeout = 15000');
    this.ensureSchema();
    this.logger.log(`Online platform registry ready at ${file}`);
    this.adoptLegacyClinicIfNeeded();
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.some((col) => col.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
        admin_notes TEXT,
        trial_type TEXT,
        doctor_name TEXT
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
      CREATE TABLE IF NOT EXISTS clinic_trial_accounts (
        clinic_id TEXT PRIMARY KEY,
        trial_type TEXT NOT NULL,
        doctor_name TEXT,
        username TEXT,
        password_plain TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );
      CREATE TABLE IF NOT EXISTS clinic_signup_invites (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        used_clinic_id TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sync_pairing_codes (
        code_hash TEXT PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        created_by_user_id INTEGER,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        challenge TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sync_registered_devices (
        id TEXT PRIMARY KEY,
        clinic_id TEXT NOT NULL,
        name TEXT,
        secret_hash TEXT NOT NULL,
        installation_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT,
        revoked_at TEXT,
        pull_checkpoint INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ai_usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id TEXT,
        model TEXT,
        duration_ms INTEGER,
        rounds INTEGER,
        has_image INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        clinic_id TEXT,
        target TEXT,
        details TEXT,
        ip TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.addColumnIfMissing('clinics', 'trial_type', 'TEXT');
    this.addColumnIfMissing('clinics', 'doctor_name', 'TEXT');
    this.addColumnIfMissing('sync_pairing_codes', 'challenge', 'TEXT');
    this.migrateTrialPasswords();
  }

  private migrateTrialPasswords(): void {
    const rows = this.db
      .prepare(`SELECT clinic_id AS clinicId, password_plain AS passwordPlain FROM clinic_trial_accounts`)
      .all() as Array<{ clinicId: string; passwordPlain: string | null }>;
    const update = this.db.prepare(`UPDATE clinic_trial_accounts SET password_plain = ? WHERE clinic_id = ?`);
    for (const row of rows) {
      if (!row.passwordPlain || row.passwordPlain.startsWith('enc:v1:')) continue;
      update.run(this.encryptSecret(row.passwordPlain), row.clinicId);
    }
  }

  private mapTrialAccount(row: Record<string, unknown>): ClinicTrialAccount {
    return {
      clinicId: String(row.clinic_id ?? ''),
      trialType: row.trial_type as ClinicTrialType,
      doctorName: (row.doctor_name as string | null) ?? null,
      username: (row.username as string | null) ?? null,
      passwordPlain: this.decryptSecret((row.password_plain as string | null) ?? null),
      createdAt: String(row.created_at ?? ''),
    };
  }

  createSignupInvite(createdBy?: string, ttlHours = 72): { token: string; expiresAt: string } {
    this.assertEnabled();
    const token = crypto.randomBytes(18).toString('base64url');
    const codeHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        `INSERT INTO clinic_signup_invites (id, code_hash, expires_at, created_by) VALUES (?, ?, ?, ?)`,
      )
      .run(crypto.randomUUID(), codeHash, expiresAt, createdBy ?? 'dibnova-admin');
    this.logEvent(null, 'SIGNUP_INVITE', expiresAt);
    return { token, expiresAt };
  }

  consumeSignupInvite(token: string): void {
    this.assertEnabled();
    const consumed = consumeHashedOneTimeRow(this.db, {
      table: 'clinic_signup_invites',
      hash: this.hashToken(token.trim()),
      nowIso: new Date().toISOString(),
    });
    if (!consumed) {
      throw new Error('INVALID_INVITE');
    }
  }

  createPairingCode(clinicId: string, createdByUserId: number, ttlMinutes = 10): {
    code: string;
    expiresAt: string;
    challenge: string;
  } {
    this.assertEnabled();
    this.requireClinic(clinicId);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i += 1) code += alphabet[crypto.randomInt(0, alphabet.length)];
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const challenge = crypto.randomBytes(32).toString('hex');
    this.db
      .prepare(
        `INSERT INTO sync_pairing_codes (code_hash, clinic_id, created_by_user_id, expires_at, challenge)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(this.hashToken(code), clinicId, createdByUserId, expiresAt, challenge);
    return { code, expiresAt, challenge };
  }

  peekPairingCode(code: string): { clinicId: string; expiresAt: string; challenge: string } {
    this.assertEnabled();
    const row = this.db
      .prepare(`SELECT clinic_id, expires_at, used_at, challenge FROM sync_pairing_codes WHERE code_hash = ?`)
      .get(this.hashToken(code.trim().toUpperCase())) as
      | { clinic_id: string; expires_at: string; used_at: string | null; challenge: string | null }
      | undefined;
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error('INVALID_PAIRING');
    }
    return { clinicId: row.clinic_id, expiresAt: row.expires_at, challenge: row.challenge || '' };
  }

  consumePairingCode(code: string): string {
    this.assertEnabled();
    const consumed = consumeHashedOneTimeRow(this.db, {
      table: 'sync_pairing_codes',
      hash: this.hashToken(code.trim().toUpperCase()),
      nowIso: new Date().toISOString(),
    });
    if (!consumed?.clinicId) {
      throw new Error('INVALID_PAIRING');
    }
    return consumed.clinicId;
  }

  registerSyncDevice(input: {
    clinicId: string;
    name: string;
    secretHash: string;
    installationId?: string | null;
  }): string {
    this.assertEnabled();
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO sync_registered_devices (id, clinic_id, name, secret_hash, installation_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.clinicId, input.name, input.secretHash, input.installationId ?? null);
    return id;
  }

  findSyncDevice(deviceId: string): {
    id: string;
    clinicId: string;
    name: string;
    secretHash: string;
    installationId: string | null;
    revokedAt: string | null;
    pullCheckpoint: number;
  } | null {
    this.assertEnabled();
    const row = this.db.prepare(`SELECT * FROM sync_registered_devices WHERE id = ?`).get(deviceId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      clinicId: String(row.clinic_id),
      name: String(row.name ?? ''),
      secretHash: String(row.secret_hash),
      installationId: (row.installation_id as string | null) ?? null,
      revokedAt: (row.revoked_at as string | null) ?? null,
      pullCheckpoint: Number(row.pull_checkpoint ?? 0),
    };
  }

  touchSyncDevice(deviceId: string): void {
    this.assertEnabled();
    this.db.prepare(`UPDATE sync_registered_devices SET last_seen_at = datetime('now') WHERE id = ?`).run(deviceId);
  }

  setDeviceCheckpoint(deviceId: string, seq: number): void {
    this.assertEnabled();
    this.db.prepare(`UPDATE sync_registered_devices SET pull_checkpoint = ? WHERE id = ?`).run(seq, deviceId);
  }

  revokeSyncDevice(clinicId: string, deviceId: string): boolean {
    this.assertEnabled();
    const result = this.db
      .prepare(
        `UPDATE sync_registered_devices SET revoked_at = datetime('now') WHERE id = ? AND clinic_id = ? AND revoked_at IS NULL`,
      )
      .run(deviceId, clinicId);
    if (result.changes > 0) {
      this.logEvent(clinicId, 'DEVICE_REVOKE', deviceId);
    }
    return result.changes > 0;
  }

  listSyncDevices(clinicId: string) {
    this.assertEnabled();
    return this.db
      .prepare(
        `SELECT id, name, installation_id AS installationId, created_at AS createdAt, last_seen_at AS lastSeenAt,
                revoked_at AS revokedAt, pull_checkpoint AS pullCheckpoint
         FROM sync_registered_devices WHERE clinic_id = ? ORDER BY created_at DESC`,
      )
      .all(clinicId);
  }

  recordAiUsage(input: {
    clinicId: string | null;
    model: string;
    durationMs: number;
    rounds: number;
    hasImage: boolean;
  }): void {
    if (!this.isEnabled()) return;
    this.db
      .prepare(
        `INSERT INTO ai_usage_events (clinic_id, model, duration_ms, rounds, has_image)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.clinicId, input.model, input.durationMs, input.rounds, input.hasImage ? 1 : 0);
  }

  listAiUsage(clinicId?: string) {
    this.assertEnabled();
    const rows = clinicId
      ? (this.db
          .prepare(
            `SELECT clinic_id AS clinicId, COUNT(*) AS calls, COALESCE(SUM(duration_ms), 0) AS durationMs,
                    COALESCE(SUM(has_image), 0) AS imageCalls
             FROM ai_usage_events WHERE clinic_id = ? GROUP BY clinic_id`,
          )
          .all(clinicId) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(
            `SELECT clinic_id AS clinicId, COUNT(*) AS calls, COALESCE(SUM(duration_ms), 0) AS durationMs,
                    COALESCE(SUM(has_image), 0) AS imageCalls
             FROM ai_usage_events GROUP BY clinic_id ORDER BY calls DESC LIMIT 200`,
          )
          .all() as Array<Record<string, unknown>>);
    return rows.map((row) => ({
      clinicId: (row.clinicId as string | null) ?? null,
      calls: Number(row.calls ?? 0),
      durationMs: Number(row.durationMs ?? 0),
      imageCalls: Number(row.imageCalls ?? 0),
    }));
  }

  clinicOpsSummary(clinicId: string) {
    this.assertEnabled();
    const clinic = this.requireClinic(clinicId);
    let patientCount = 0;
    if (fs.existsSync(clinic.dbPath)) {
      const clinicDb = new Database(clinic.dbPath, { readonly: true, fileMustExist: true });
      try {
        const row = clinicDb
          .prepare(`SELECT COUNT(*) AS c FROM patients WHERE archived_at IS NULL`)
          .get() as { c: number };
        patientCount = Number(row?.c ?? 0);
      } catch {
        patientCount = 0;
      } finally {
        clinicDb.close();
      }
    }
    const backupsDir = path.join(this.clinicDataDir(clinicId), 'backups');
    const attachmentsDir = path.join(this.clinicDataDir(clinicId), 'attachments');
    const backups = fs.existsSync(backupsDir)
      ? fs.readdirSync(backupsDir).filter((f) => f.endsWith('.zip')).length
      : 0;
    return {
      clinicId,
      clinicName: clinic.name,
      patientCount,
      backupZipCount: backups,
      attachmentBytes: this.directorySize(attachmentsDir),
      clinicDbBytes: fs.existsSync(clinic.dbPath) ? fs.statSync(clinic.dbPath).size : 0,
      syncDevices: this.listSyncDevices(clinicId),
    };
  }

  private directorySize(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else {
          try {
            total += fs.statSync(full).size;
          } catch {
            /* ignore */
          }
        }
      }
    }
    return total;
  }

  private secretsKey(): Buffer {
    const dedicated = this.config.get<string>('PLATFORM_SECRETS_KEY')?.trim();
    const fallback = this.config.get<string>('JWT_SECRET')?.trim() || 'dev-secret';
    if (!dedicated && this.config.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('PLATFORM_SECRETS_KEY is not set; trial password encryption falls back to JWT_SECRET.');
    }
    const raw = dedicated || fallback;
    return crypto.createHash('sha256').update(`dentalnova-platform|${raw}`).digest();
  }

  encryptSecret(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretsKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
  }

  decryptSecret(stored: string | null): string | null {
    if (!stored) return null;
    if (!stored.startsWith('enc:v1:')) return stored;
    const parts = stored.split(':');
    if (parts.length !== 5) return null;
    try {
      const iv = Buffer.from(parts[2], 'base64url');
      const tag = Buffer.from(parts[3], 'base64url');
      const data = Buffer.from(parts[4], 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.secretsKey(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  private hashToken(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
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
      trialType: (row.trial_type as ClinicTrialType | null) ?? null,
      doctorName: (row.doctor_name as string | null) ?? null,
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
