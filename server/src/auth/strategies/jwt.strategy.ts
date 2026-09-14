import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../auth.types';
import { JwtSecretService } from '../jwt-secret.service';
import { DeploymentService } from '../../common/deployment.service';
import { PlatformService } from '../../platform/platform.service';
import { bindTenant, runInTenant } from '../../platform/tenant-context';
import { isLoopbackRequest } from '../../common/loopback.util';
import { isAdminJwtPayload, isSessionJwtPayload, SESSION_JWT_ISSUER } from '../jwt-payload.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtSecret: JwtSecretService,
    private readonly deployment: DeploymentService,
    private readonly platform: PlatformService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      issuer: SESSION_JWT_ISSUER,
      secretOrKeyProvider: (
        _request: Request,
        _rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        done(null, jwtSecret.getSecret());
      },
    });
  }

  validate(req: Request, payload: JwtPayload) {
    if (
      !isSessionJwtPayload(payload) ||
      isAdminJwtPayload(payload) ||
      payload.dibnovaAdmin ||
      (payload as { purpose?: string }).purpose === 'password_reset'
    ) {
      throw new UnauthorizedException();
    }
    if (this.jwtSecret.isInsecureDevSecret() && !isLoopbackRequest(req)) {
      throw new UnauthorizedException();
    }
    try {
      if (this.deployment.isOnline()) {
        const clinicId = payload.clinicId?.trim();
        if (!clinicId || !this.platform.findClinic(clinicId)) {
          throw new UnauthorizedException();
        }
        const user = runInTenant(clinicId, () => {
          const authenticated = this.authService.toAuthenticatedUser(payload.sub, clinicId);
          if (authenticated.username !== payload.username) {
            throw new UnauthorizedException();
          }
          return authenticated;
        });
        bindTenant(clinicId);
        return user;
      }
      return this.authService.toAuthenticatedUser(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
