import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InstallationService } from '../installation.service';

export const SKIP_INSTALLATION_GUARD = 'skipInstallationGuard';

@Injectable()
export class InstallationReadyGuard implements CanActivate {
  constructor(
    private readonly installation: InstallationService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_INSTALLATION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req.path ?? req.url ?? '';
    if (path.startsWith('/api/installation') || path.startsWith('/api/health')) {
      return true;
    }

    if (!this.installation.isReady()) {
      throw new ServiceUnavailableException({
        code: 'INSTALLATION_NOT_READY',
        message: 'Clinic installation is not complete. Finish activation and first setup.',
      });
    }
    return true;
  }
}
