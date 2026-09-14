import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthenticatedUser } from '../auth/auth.types';
import { requestClientIp } from '../common/loopback.util';
import { PlatformService } from '../platform/platform.service';
import { sanitizeAdminAuditDetails } from './admin-audit.util';
import { AdminRequest } from './dibnova-admin.guard';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly platform: PlatformService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next.handle();
    }

    const action = `${req.method} ${req.path || req.url || ''}`.replace(/\/api(?=\/)/, '');
    const clinicId =
      (typeof req.params?.clinicId === 'string' && req.params.clinicId) ||
      (typeof req.body?.clinicId === 'string' && req.body.clinicId) ||
      null;
    const user = req.user as AuthenticatedUser | undefined;
    const actor = user?.username || (req.adminAuthMethod === 'api-key' ? 'api-key' : 'unknown');
    const target =
      req.params?.id != null
        ? String(req.params.id)
        : req.body?.userId != null
          ? `user:${req.body.userId}`
          : null;
    const details = sanitizeAdminAuditDetails({
      notes: req.body?.notes,
      reason: req.body?.reason,
      days: req.body?.days,
      expiresAt: req.body?.expiresAt,
      roleName: req.body?.roleName,
      isActive: req.body?.isActive,
      method: req.body?.method,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          this.platform.recordAdminAudit({
            actor,
            action,
            clinicId,
            target,
            details,
            ip: requestClientIp(req),
          });
        },
      }),
    );
  }
}
