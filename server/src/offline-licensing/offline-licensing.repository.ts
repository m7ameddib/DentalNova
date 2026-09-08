import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type OfflineLicenseSlotStatus = 'pending' | 'redeemed' | 'revoked';

export interface OfflineLicenseSlotRow {
  id: number;
  clinicId: string;
  clinicName: string;
  licenseId: string;
  activationCodeLookup: string;
  installationId: string | null;
  status: OfflineLicenseSlotStatus;
  slotExpiresAt: string | null;
  licenseExpiresAt: string | null;
  redeemedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
}

@Injectable()
export class OfflineLicensingRepository {
  constructor(private readonly db: DatabaseService) {}

  findByActivationLookup(lookup: string): OfflineLicenseSlotRow | null {
    const row = this.db.connection
      .prepare('SELECT * FROM offline_license_slots WHERE activation_code_lookup = ?')
      .get(lookup) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  findByClinicId(clinicId: string): OfflineLicenseSlotRow | null {
    const row = this.db.connection
      .prepare('SELECT * FROM offline_license_slots WHERE clinic_id = ?')
      .get(clinicId.trim()) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  listRecent(limit = 50): OfflineLicenseSlotRow[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM offline_license_slots
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => this.map(row));
  }

  create(params: {
    clinicId: string;
    clinicName: string;
    licenseId: string;
    activationCodeLookup: string;
    installationId?: string | null;
    slotExpiresAt?: string | null;
    licenseExpiresAt?: string | null;
    adminNotes?: string | null;
  }): OfflineLicenseSlotRow {
    this.db.connection
      .prepare(
        `INSERT INTO offline_license_slots (
          clinic_id, clinic_name, license_id, activation_code_lookup,
          installation_id, slot_expires_at, license_expires_at, admin_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.clinicId.trim(),
        params.clinicName.trim(),
        params.licenseId,
        params.activationCodeLookup,
        params.installationId?.trim() || null,
        params.slotExpiresAt ?? null,
        params.licenseExpiresAt ?? null,
        params.adminNotes?.trim() || null,
      );
    const created = this.findByClinicId(params.clinicId);
    if (!created) {
      throw new Error('Failed to create offline license slot.');
    }
    return created;
  }

  markRedeemed(id: number, installationId: string): void {
    this.db.connection
      .prepare(
        `UPDATE offline_license_slots SET
          status = 'redeemed',
          installation_id = ?,
          redeemed_at = datetime('now')
         WHERE id = ?`,
      )
      .run(installationId.trim(), id);
  }

  private map(row: Record<string, unknown>): OfflineLicenseSlotRow {
    return {
      id: row.id as number,
      clinicId: row.clinic_id as string,
      clinicName: row.clinic_name as string,
      licenseId: row.license_id as string,
      activationCodeLookup: row.activation_code_lookup as string,
      installationId: (row.installation_id as string | null) ?? null,
      status: row.status as OfflineLicenseSlotStatus,
      slotExpiresAt: (row.slot_expires_at as string | null) ?? null,
      licenseExpiresAt: (row.license_expires_at as string | null) ?? null,
      redeemedAt: (row.redeemed_at as string | null) ?? null,
      adminNotes: (row.admin_notes as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  }
}
