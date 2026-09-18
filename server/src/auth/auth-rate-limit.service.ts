import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { PathsService } from '../common/paths.service';
import {
  clearRateLimitWindow,
  getRateLimitWindow,
  incrementRateLimitFailure,
  openSharedDurableStore,
  pruneExpiredRateLimits,
} from '../common/shared-durable-store';
import { RateLimitWindow } from './auth-rate-limit.persist';

@Injectable()
export class AuthRateLimitService {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private readonly memory = new Map<string, RateLimitWindow>();
  private store: ReturnType<typeof openSharedDurableStore> | null = null;

  constructor(@Optional() private readonly paths?: PathsService) {
    this.hydrate();
  }

  assertAllowed(key: string, limit: number, windowMs: number): void {
    this.prune();
    const now = Date.now();
    const existing = this.readWindow(key, now);
    if (existing && existing.resetAt > now && existing.count >= limit) {
      throw new HttpException(
        { statusCode: 429, message: 'Too many attempts. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string, windowMs: number): void {
    const now = Date.now();
    if (this.store) {
      incrementRateLimitFailure(this.store, key, windowMs, now);
      return;
    }
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      existing.count += 1;
    }
  }

  recordSuccess(key: string): void {
    if (this.store) {
      clearRateLimitWindow(this.store, key);
      return;
    }
    this.memory.delete(key);
  }

  private readWindow(key: string, now: number): RateLimitWindow | null {
    if (this.store) return getRateLimitWindow(this.store, key, now);
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) return null;
    return existing;
  }

  private prune(): void {
    const now = Date.now();
    if (this.store) {
      pruneExpiredRateLimits(this.store, now);
      return;
    }
    if (this.memory.size < 2000) return;
    for (const [key, value] of this.memory) {
      if (value.resetAt <= now) this.memory.delete(key);
    }
  }

  private hydrate(): void {
    if (!this.paths) return;
    try {
      this.store = openSharedDurableStore(this.paths.configDir());
      this.logger.log(
        'Auth rate limits persist in shared-durable.db (shared across processes that use the same data directory).',
      );
    } catch (err) {
      this.logger.warn(`Could not open shared rate-limit store: ${(err as Error).message}`);
    }
  }
}
