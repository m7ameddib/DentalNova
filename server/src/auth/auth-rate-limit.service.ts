import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface WindowCount {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly windows = new Map<string, WindowCount>();

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
      return;
    }
    existing.count += 1;
  }

  recordSuccess(key: string): void {
    this.windows.delete(key);
  }

  private prune(): void {
    const now = Date.now();
    if (this.windows.size < 2000) return;
    for (const [key, value] of this.windows) {
      if (value.resetAt <= now) this.windows.delete(key);
    }
  }
}
