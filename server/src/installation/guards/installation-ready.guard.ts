import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InstallationService } from '../installation.service';
import { DeploymentService } from '../../common/deployment.service';
import { isLoopbackRequest } from '../../common/loopback.util';

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

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    const isPublicInstallPath =
      path.startsWith('/api/installation') ||
      path.startsWith('/api/health') ||
      path.startsWith('/api/ai-provider');

    if (!this.installation.isSetupComplete() && !isLoopbackRequest(req)) {
      throw new ForbiddenException({
        code: 'SETUP_LOCAL_ONLY',
        message: 'Complete first-time setup from this computer (localhost) before LAN access is allowed.',
      });
    }

    if (isPublicInstallPath) {
      return true;
    }

    if (this.installation.isLicenseExpired()) {
      throw new ServiceUnavailableException({
        code: 'LICENSE_EXPIRED',
        message: 'This offline license has expired. Contact DibNova to renew.',
      });
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
