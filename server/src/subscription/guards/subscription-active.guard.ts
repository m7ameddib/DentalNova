import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { DeploymentService } from '../../common/deployment.service';
import { getTenantClinicId } from '../../platform/tenant-context';
import { PlatformService } from '../../platform/platform.service';

export const SKIP_SUBSCRIPTION_GUARD = 'skipSubscriptionGuard';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly subscription: SubscriptionService,
    private readonly reflector: Reflector,
    private readonly deployment: DeploymentService,
    private readonly platform: PlatformService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    if (this.deployment.isOnline() && this.platform.isEnabled()) {
      const req = context.switchToHttp().getRequest<{
        path?: string;
        url?: string;
        user?: { clinicId?: string };
      }>();
      const path = req.path ?? req.url ?? '';
      if (this.isPublicPath(path)) return true;
      const clinicId = getTenantClinicId() || req.user?.clinicId?.trim();
      if (!clinicId) {
        throw new ForbiddenException({
          code: 'CLINIC_CONTEXT_REQUIRED',
          message: 'This request is not bound to a clinic.',
        });
      }
      if (!this.platform.canUseSystem(clinicId)) {
        const status = this.platform.getSubscription(clinicId).status;
        throw new ForbiddenException({
          code: 'SUBSCRIPTION_NOT_ACTIVE',
          status,
          message: 'This online clinic subscription is not active. Contact DibNova support.',
        });
      }
      return true;
    }

    if (!this.subscription.isApplicable()) return true;

    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req.path ?? req.url ?? '';
    if (this.isPublicPath(path)) return true;

    if (!this.subscription.canUseSystem()) {
      const status = this.subscription.effectiveStatus();
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        status,
        message: 'This online clinic subscription is not active. Contact DibNova support.',
      });
    }

    return true;
  }

  private isPublicPath(path: string): boolean {
    const normalized = path.split('?')[0];
    const prefixes = [
      '/api/installation',
      '/installation',
      '/api/health',
      '/health',
      '/api/subscription',
      '/subscription',
      '/api/licensing',
      '/licensing',
      '/api/dibnova-admin',
      '/dibnova-admin',
      '/api/auth/login',
      '/auth/login',
      '/api/auth/forgot-password',
      '/auth/forgot-password',
      '/api/auth/verify-reset-otp',
      '/auth/verify-reset-otp',
      '/api/auth/reset-password',
      '/auth/reset-password',
    ];
    return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  }
}
