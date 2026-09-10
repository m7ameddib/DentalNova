import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../auth/auth.types';
import { bindTenant } from './tenant-context';

/**
 * Re-binds the verified JWT clinicId just before the controller runs.
 * Middleware/Passport hops can drop AsyncLocalStorage; without this, Online
 * queries fall back to the empty default clinic.db and clinic data "vanishes".
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const clinicId = req.user?.clinicId?.trim();
    if (clinicId) {
      bindTenant(clinicId);
    }
    return next.handle();
  }
}
