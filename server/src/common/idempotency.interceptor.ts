import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
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
    try {
      this.ensureTable();
      const existing = this.database.connection
        .prepare('SELECT response_json FROM request_idempotency WHERE key = ?')
        .get(key) as { response_json: string } | undefined;
      if (existing) {
        return of(JSON.parse(existing.response_json));
      }
    } catch {
      return next.handle();
    }

    return next.handle().pipe(
      tap((data) => {
        try {
          this.database.connection
            .prepare(
              `INSERT OR IGNORE INTO request_idempotency (key, method, path, status_code, response_json)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .run(key, method, path, 200, JSON.stringify(data ?? null));
        } catch {
          /* never block a successful write because the replay log failed */
        }
      }),
    );
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
