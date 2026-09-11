import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InstallationService } from '../installation.service';
import { DeploymentService } from '../../common/deployment.service';

export const SKIP_INSTALLATION_GUARD = 'skipInstallationGuard';

@Injectable()
export class InstallationReadyGuard implements CanActivate {
  constructor(
    private readonly installation: InstallationService,
    private readonly reflector: Reflector,
    private readonly deployment: DeploymentService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_INSTALLATION_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;
    if (this.deployment.isOnline()) return true;

    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req.path ?? req.url ?? '';
    if (path.startsWith('/api/installation') || path.startsWith('/api/health') || path.startsWith('/api/ai-provider')) {
      return true;
    }

    if (!this.installation.isReady()) {
      throw new ServiceUnavailableException({
        code: 'INSTALLATION_NOT_READY',
        message: 'Clinic installation is not complete. Finish setup to continue.',
      });
    }
    return true;
  }
}
