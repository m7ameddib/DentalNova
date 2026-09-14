import { CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly database: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
      is?: (type: string) => boolean;
    }>();
    const res = context.switchToHttp().getResponse<{ statusCode?: number; status?: (code: number) => void }>();
    const method = (req.method ?? 'GET').toUpperCase();
    const keyHeader = req.headers?.['x-idempotency-key'];
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
    if (!key || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }
    if (typeof req.is === 'function' && req.is('multipart/form-data')) {
      return next.handle();
    }

    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
    this.ensureTable();

    const existing = this.database.connection
      .prepare('SELECT method, path, status_code, response_json FROM request_idempotency WHERE key = ?')
      .get(key) as { method: string; path: string; status_code: number; response_json: string } | undefined;
    if (existing) {
      if (existing.method !== method || existing.path !== path) {
        throw new ConflictException('Idempotency key already used for a different request');
      }
      if (existing.status_code === 0) {
        throw new ConflictException('A request with this idempotency key is already in progress');
      }
      res.status?.(existing.status_code);
      return of(JSON.parse(existing.response_json));
    }

    const reserved = this.database.connection
      .prepare(
        `INSERT OR IGNORE INTO request_idempotency (key, method, path, status_code, response_json)
         VALUES (?, ?, ?, 0, '')`,
      )
      .run(key, method, path);
    if (reserved.changes === 0) {
      const raced = this.database.connection
        .prepare('SELECT method, path, status_code, response_json FROM request_idempotency WHERE key = ?')
        .get(key) as { method: string; path: string; status_code: number; response_json: string } | undefined;
      if (raced && raced.status_code > 0) {
        if (raced.method !== method || raced.path !== path) {
          throw new ConflictException('Idempotency key already used for a different request');
        }
        res.status?.(raced.status_code);
        return of(JSON.parse(raced.response_json));
      }
      throw new ConflictException('A request with this idempotency key is already in progress');
    }

    return next.handle().pipe(
      map((data) => {
        const statusCode = Number(res.statusCode || 200);
        this.store(key, method, path, statusCode, data);
        return data;
      }),
      catchError((err) => {
        try {
          this.database.connection.prepare('DELETE FROM request_idempotency WHERE key = ? AND status_code = 0').run(key);
        } catch {
          /* ignore */
        }
        throw err;
      }),
    );
  }

  private store(key: string, method: string, path: string, statusCode: number, data: unknown): void {
    try {
      this.database.connection
        .prepare(
          `UPDATE request_idempotency
           SET status_code = ?, response_json = ?
           WHERE key = ?`,
        )
        .run(statusCode, JSON.stringify(data ?? null), key);
    } catch {
      /* never block a successful write because the replay log failed */
    }
  }

  private ensureTable(): void {
    this.database.connection.exec(
      `CREATE TABLE IF NOT EXISTS request_idempotency (
        key TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    );
  }
}
