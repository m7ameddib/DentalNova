import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OnlineSubscriptionRow, OnlineSubscriptionStatus } from './subscription.types';

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly db: DatabaseService) {}

  get(): OnlineSubscriptionRow {
    const row = this.db.connection
      .prepare(
        `SELECT online_subscription_status, online_subscription_started_at,
                online_subscription_expires_at, online_subscription_suspended_at,
                online_subscription_suspended_reason, online_admin_notes
         FROM app_installation WHERE id = 1`,
      )
      .get() as Record<string, unknown> | undefined;

    if (!row) {
      return {
        status: null,
        startedAt: null,
        expiresAt: null,
        suspendedAt: null,
        suspendedReason: null,
        adminNotes: null,
      };
    }

    return {
      status: (row.online_subscription_status as OnlineSubscriptionStatus | null) ?? null,
      startedAt: (row.online_subscription_started_at as string | null) ?? null,
      expiresAt: (row.online_subscription_expires_at as string | null) ?? null,
      suspendedAt: (row.online_subscription_suspended_at as string | null) ?? null,
      suspendedReason: (row.online_subscription_suspended_reason as string | null) ?? null,
      adminNotes: (row.online_admin_notes as string | null) ?? null,
    };
  }

  setPending(): void {
    this.db.connection
      .prepare(
        `UPDATE app_installation SET
          online_subscription_status = 'PENDING',
          online_subscription_started_at = NULL,
          online_subscription_expires_at = NULL,
          online_subscription_suspended_at = NULL,
          online_subscription_suspended_reason = NULL
         WHERE id = 1`,
      )
      .run();
  }

  setActive(startedAt: string, expiresAt: string, adminNotes?: string | null): void {
    this.db.connection
      .prepare(
        `UPDATE app_installation SET
          online_subscription_status = 'ACTIVE',
          online_subscription_started_at = ?,
          online_subscription_expires_at = ?,
          online_subscription_suspended_at = NULL,
          online_subscription_suspended_reason = NULL,
          online_admin_notes = COALESCE(?, online_admin_notes)
         WHERE id = 1`,
      )
      .run(startedAt, expiresAt, adminNotes ?? null);
  }

  setExpired(): void {
    this.db.connection
      .prepare(`UPDATE app_installation SET online_subscription_status = 'EXPIRED' WHERE id = 1`)
      .run();
  }

  setSuspended(reason: string | null): void {
    this.db.connection
      .prepare(
        `UPDATE app_installation SET
          online_subscription_status = 'SUSPENDED',
          online_subscription_suspended_at = datetime('now'),
          online_subscription_suspended_reason = ?
         WHERE id = 1`,
      )
      .run(reason);
  }

  extendExpiry(expiresAt: string, adminNotes?: string | null): void {
    this.db.connection
      .prepare(
        `UPDATE app_installation SET
          online_subscription_status = 'ACTIVE',
          online_subscription_expires_at = ?,
          online_subscription_suspended_at = NULL,
          online_subscription_suspended_reason = NULL,
          online_admin_notes = COALESCE(?, online_admin_notes)
         WHERE id = 1`,
      )
      .run(expiresAt, adminNotes ?? null);
  }

  setAdminNotes(notes: string | null): void {
    this.db.connection
      .prepare(`UPDATE app_installation SET online_admin_notes = ? WHERE id = 1`)
      .run(notes);
  }
}
