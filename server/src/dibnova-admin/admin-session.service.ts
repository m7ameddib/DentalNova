import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import { PathsService } from '../common/paths.service';
import { adminRevokedFilePath, loadRevokedAdminJti, saveRevokedAdminJti } from './admin-session.persist';

/**
 * Denylist for DibNova admin JWTs after logout. Persisted next to other
 * config so a restart (or a second process sharing DNT_DATA_DIR) still
 * rejects the token until expiry.
 */
@Injectable()
export class AdminSessionService {
  private readonly logger = new Logger(AdminSessionService.name);
  private readonly revoked = new Map<string, number>();
  private persistWarned = false;

  constructor(@Optional() private readonly paths?: PathsService) {
    this.hydrate();
  }

  revoke(jti: string, expUnixSec?: number): void {
    const id = jti.trim();
    if (!id) return;
    const expMs = expUnixSec && expUnixSec > 0 ? expUnixSec * 1000 : Date.now() + 8 * 60 * 60 * 1000;
    this.revoked.set(id, expMs);
    this.prune();
    this.persist();
  }

  isRevoked(jti: string | undefined | null): boolean {
    if (!jti?.trim()) return false;
    this.prune();
    const expMs = this.revoked.get(jti.trim());
    if (expMs == null) return false;
    if (expMs <= Date.now()) {
      this.revoked.delete(jti.trim());
      this.persist();
      return false;
    }
    return true;
  }

  private prune(): void {
    const now = Date.now();
    if (this.revoked.size < 500) return;
    for (const [id, expMs] of this.revoked) {
      if (expMs <= now) this.revoked.delete(id);
    }
  }

  private hydrate(): void {
    if (!this.paths) return;
    try {
      const loaded = loadRevokedAdminJti(adminRevokedFilePath(this.paths.configDir()));
      for (const [jti, expMs] of loaded) this.revoked.set(jti, expMs);
    } catch (err) {
      this.logger.warn(`Could not load revoked admin sessions: ${(err as Error).message}`);
    }
  }

  private persist(): void {
    if (!this.paths) return;
    try {
      const dir = this.paths.configDir();
      fs.mkdirSync(dir, { recursive: true });
      saveRevokedAdminJti(adminRevokedFilePath(dir), this.revoked);
    } catch (err) {
      if (!this.persistWarned) {
        this.persistWarned = true;
        this.logger.warn(
          `Could not persist revoked admin sessions (in-memory only until restart): ${(err as Error).message}`,
        );
      }
    }
  }
}
