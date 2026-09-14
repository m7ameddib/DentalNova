import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import { PathsService } from '../common/paths.service';
import {
  loadRateLimitWindows,
  RateLimitWindow,
  rateLimitFilePath,
  saveRateLimitWindows,
} from './auth-rate-limit.persist';

@Injectable()
export class AuthRateLimitService {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private readonly windows = new Map<string, RateLimitWindow>();
  private persistWarned = false;

  constructor(@Optional() private readonly paths?: PathsService) {
    this.hydrate();
  }

  assertAllowed(key: string, limit: number, windowMs: number): void {
    this.prune();
    const now = Date.now();
    const existing = this.windows.get(key);
    if (existing && existing.resetAt > now && existing.count >= limit) {
      throw new HttpException(
        { statusCode: 429, message: 'Too many attempts. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string, windowMs: number): void {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      existing.count += 1;
    }
    this.persist();
  }

  recordSuccess(key: string): void {
    this.windows.delete(key);
    this.persist();
  }

  private prune(): void {
    const now = Date.now();
    if (this.windows.size < 2000) return;
    for (const [key, value] of this.windows) {
      if (value.resetAt <= now) this.windows.delete(key);
    }
  }

  private hydrate(): void {
    if (!this.paths) return;
    try {
      const file = rateLimitFilePath(this.paths.configDir());
      const loaded = loadRateLimitWindows(file);
      for (const [key, value] of loaded) this.windows.set(key, value);
      if (loaded.size > 0) {
        this.logger.log(`Restored ${loaded.size} auth rate-limit window(s) from disk.`);
      }
      this.logger.log(
        'Auth rate limits persist on this process (survive restarts). They are not shared across multiple app instances.',
      );
    } catch (err) {
      this.logger.warn(`Could not load persisted rate limits: ${(err as Error).message}`);
    }
  }

  private persist(): void {
    if (!this.paths) return;
    try {
      const dir = this.paths.configDir();
      fs.mkdirSync(dir, { recursive: true });
      saveRateLimitWindows(rateLimitFilePath(dir), this.windows);
    } catch (err) {
      if (!this.persistWarned) {
        this.persistWarned = true;
        this.logger.warn(
          `Could not persist rate-limit windows (in-memory only until restart): ${(err as Error).message}`,
        );
      }
    }
  }
}
