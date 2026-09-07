import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface OnlineClinicAccountRow {
  id: number;
  username: string;
  phoneNormalized: string;
  installationId: string;
  adminUserId: number;
  createdAt: string;
}

@Injectable()
export class OnlineClinicAccountsRepository {
  constructor(private readonly db: DatabaseService) {}

  findByUsername(username: string): OnlineClinicAccountRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, username, phone_normalized AS phoneNormalized, installation_id AS installationId,
                admin_user_id AS adminUserId, created_at AS createdAt
         FROM online_clinic_accounts WHERE username = ? COLLATE NOCASE`,
      )
      .get(username.trim()) as OnlineClinicAccountRow | undefined;
    return row;
  }

  findByPhoneNormalized(phoneNormalized: string): OnlineClinicAccountRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, username, phone_normalized AS phoneNormalized, installation_id AS installationId,
                admin_user_id AS adminUserId, created_at AS createdAt
         FROM online_clinic_accounts WHERE phone_normalized = ?`,
      )
      .get(phoneNormalized) as OnlineClinicAccountRow | undefined;
    return row;
  }

  findByInstallationId(installationId: string): OnlineClinicAccountRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, username, phone_normalized AS phoneNormalized, installation_id AS installationId,
                admin_user_id AS adminUserId, created_at AS createdAt
         FROM online_clinic_accounts WHERE installation_id = ?`,
      )
      .get(installationId) as OnlineClinicAccountRow | undefined;
    return row;
  }

  create(input: {
    username: string;
    phoneNormalized: string;
    installationId: string;
    adminUserId: number;
  }): OnlineClinicAccountRow {
    const result = this.db.connection
      .prepare(
        `INSERT INTO online_clinic_accounts (username, phone_normalized, installation_id, admin_user_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.username.trim(), input.phoneNormalized, input.installationId, input.adminUserId);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  private findById(id: number): OnlineClinicAccountRow | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT id, username, phone_normalized AS phoneNormalized, installation_id AS installationId,
                admin_user_id AS adminUserId, created_at AS createdAt
         FROM online_clinic_accounts WHERE id = ?`,
      )
      .get(id) as OnlineClinicAccountRow | undefined;
    return row;
  }
}
