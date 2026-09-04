import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../auth.types';

/**
 * Route-level RBAC enforcement. Works together with @RequirePermissions().
 * A route with no metadata is accessible to any authenticated user.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    const hasPermission = required.some((perm) => user.permissions.includes(perm));
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
