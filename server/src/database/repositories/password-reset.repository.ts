import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface PasswordResetOtpRow {
  id: number;
  userId: number;
  phoneNormalized: string;
  codeHash: string;
  expiresAt: string;
  usedAt: string | null;
  attemptCount: number;
  createdAt: string;
}

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly db: DatabaseService) {}

  invalidateActiveForUser(userId: number): void {
    this.db.connection
      .prepare(
        `UPDATE password_reset_otps SET used_at = datetime('now')
         WHERE user_id = ? AND used_at IS NULL`,
      )
      .run(userId);
  }

  create(input: {
    userId: number;
    phoneNormalized: string;
    codeHash: string;
    expiresAt: string;
  }): PasswordResetOtpRow {
    this.invalidateActiveForUser(input.userId);
    const result = this.db.connection
      .prepare(
        `INSERT INTO password_reset_otps (user_id, phone_normalized, code_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.userId, input.phoneNormalized, input.codeHash, input.expiresAt);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findActiveByUserId(userId: number): PasswordResetOtpRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, user_id AS userId, phone_normalized AS phoneNormalized, code_hash AS codeHash,
                expires_at AS expiresAt, used_at AS usedAt, attempt_count AS attemptCount,
                created_at AS createdAt
         FROM password_reset_otps
         WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(userId) as PasswordResetOtpRow | undefined;
    return row;
  }

  incrementAttempts(id: number): void {
    this.db.connection
      .prepare(`UPDATE password_reset_otps SET attempt_count = attempt_count + 1 WHERE id = ?`)
      .run(id);
  }

  markUsed(id: number): void {
    this.db.connection
      .prepare(`UPDATE password_reset_otps SET used_at = datetime('now') WHERE id = ?`)
      .run(id);
  }

  countRecentRequestsForPhone(phoneNormalized: string, sinceIso: string): number {
    const row = this.db.connection
      .prepare(
        `SELECT COUNT(*) AS count FROM password_reset_otps
         WHERE phone_normalized = ? AND created_at >= ?`,
      )
      .get(phoneNormalized, sinceIso) as { count: number };
    return row.count;
  }

  private findById(id: number): PasswordResetOtpRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, user_id AS userId, phone_normalized AS phoneNormalized, code_hash AS codeHash,
                expires_at AS expiresAt, used_at AS usedAt, attempt_count AS attemptCount,
                created_at AS createdAt
         FROM password_reset_otps WHERE id = ?`,
      )
      .get(id) as PasswordResetOtpRow | undefined;
    return row;
  }
}
