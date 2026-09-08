import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';

export const SKIP_SUBSCRIPTION_GUARD = 'skipSubscriptionGuard';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly subscription: SubscriptionService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    if (!this.subscription.isApplicable()) return true;

    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req.path ?? req.url ?? '';

    if (
      path.startsWith('/api/installation') ||
      path.startsWith('/api/health') ||
      path.startsWith('/api/subscription') ||
      path.startsWith('/api/licensing') ||
      path.startsWith('/api/dibnova-admin') ||
      path.startsWith('/api/auth/login') ||
      path.startsWith('/api/auth/forgot-password') ||
      path.startsWith('/api/auth/verify-reset-otp') ||
      path.startsWith('/api/auth/reset-password')
    ) {
      return true;
    }

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
}
