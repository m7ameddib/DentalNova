import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DeploymentService } from '../common/deployment.service';

export type InstallationPhase = 'activation' | 'setup' | 'ready';

export interface InstallationRow {
  id: number;
  installationId: string;
  licensePayload: string | null;
  licenseSignature: string | null;
  licenseActivatedAt: string | null;
  setupCompletedAt: string | null;
  createdAt: string;
}

@Injectable()
export class InstallationRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly deployment: DeploymentService,
  ) {}

  get(): InstallationRow {
    const row = this.db.connection
      .prepare('SELECT * FROM app_installation WHERE id = 1')
      .get() as Record<string, unknown> | undefined;
    if (!row) {
      const installationId = cryptoRandomId();
      this.db.connection
        .prepare('INSERT INTO app_installation (id, installation_id) VALUES (1, ?)')
        .run(installationId);
      return this.get();
    }
    return {
      id: row.id as number,
      installationId: row.installation_id as string,
      licensePayload: (row.license_payload as string | null) ?? null,
      licenseSignature: (row.license_signature as string | null) ?? null,
      licenseActivatedAt: (row.license_activated_at as string | null) ?? null,
      setupCompletedAt: (row.setup_completed_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  }

  saveLicense(payloadJson: string, signaturePart: string): void {
    this.db.connection
      .prepare(
        `UPDATE app_installation SET
          license_payload = ?,
          license_signature = ?,
          license_activated_at = datetime('now')
         WHERE id = 1`,
      )
      .run(payloadJson, signaturePart);
  }

  markSetupComplete(): void {
    this.db.connection
      .prepare(`UPDATE app_installation SET setup_completed_at = datetime('now') WHERE id = 1`)
      .run();
  }

  phase(): InstallationPhase {
    const row = this.get();
    if (this.deployment.requiresLicense() && !row.licenseActivatedAt) return 'activation';
    if (!row.setupCompletedAt) return 'setup';
    return 'ready';
  }
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
