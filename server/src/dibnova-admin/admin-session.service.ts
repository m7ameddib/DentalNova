import { Injectable } from '@nestjs/common';

/**
 * In-process denylist for DibNova admin JWTs after logout.
 * Stolen tokens remain valid until expiry unless explicitly revoked.
 */
@Injectable()
export class AdminSessionService {
  private readonly revoked = new Map<string, number>();

  revoke(jti: string, expUnixSec?: number): void {
    const id = jti.trim();
    if (!id) return;
    const expMs = expUnixSec && expUnixSec > 0 ? expUnixSec * 1000 : Date.now() + 8 * 60 * 60 * 1000;
    this.revoked.set(id, expMs);
    this.prune();
  }

  isRevoked(jti: string | undefined | null): boolean {
    if (!jti?.trim()) return false;
    this.prune();
    const expMs = this.revoked.get(jti.trim());
    if (expMs == null) return false;
    if (expMs <= Date.now()) {
      this.revoked.delete(jti.trim());
      return false;
    }
    return true;
  }

  private prune(): void {
    if (this.revoked.size < 500) return;
    const now = Date.now();
    for (const [id, expMs] of this.revoked) {
      if (expMs <= now) this.revoked.delete(id);
    }
  }
}
