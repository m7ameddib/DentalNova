import { Injectable, Logger, Optional } from '@nestjs/common';
import { PathsService } from '../common/paths.service';
import {
  isAdminJtiRevoked,
  openSharedDurableStore,
  pruneExpiredAdminJti,
  revokeAdminJti,
} from '../common/shared-durable-store';

/**
 * Denylist for DibNova admin JWTs after logout. Stored in shared-durable.db
 * next to other config so a restart or a second process sharing DNT_DATA_DIR
 * still rejects the token until expiry.
 */
@Injectable()
export class AdminSessionService {
  private readonly logger = new Logger(AdminSessionService.name);
  private readonly memory = new Map<string, number>();
  private store: ReturnType<typeof openSharedDurableStore> | null = null;

  constructor(@Optional() private readonly paths?: PathsService) {
    this.hydrate();
  }

  revoke(jti: string, expUnixSec?: number): void {
    const id = jti.trim();
    if (!id) return;
    const expMs = expUnixSec && expUnixSec > 0 ? expUnixSec * 1000 : Date.now() + 8 * 60 * 60 * 1000;
    if (this.store) {
      revokeAdminJti(this.store, id, expMs);
      pruneExpiredAdminJti(this.store);
      return;
    }
    this.memory.set(id, expMs);
  }

  isRevoked(jti: string | undefined | null): boolean {
    if (!jti?.trim()) return false;
    if (this.store) {
      pruneExpiredAdminJti(this.store);
      return isAdminJtiRevoked(this.store, jti);
    }
    const expMs = this.memory.get(jti.trim());
    if (expMs == null) return false;
    if (expMs <= Date.now()) {
      this.memory.delete(jti.trim());
      return false;
    }
    return true;
  }

  private hydrate(): void {
    if (!this.paths) return;
    try {
      this.store = openSharedDurableStore(this.paths.configDir());
    } catch (err) {
      this.logger.warn(`Could not load revoked admin sessions: ${(err as Error).message}`);
    }
  }
}
