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
      secretOrKeyProvider: (
        _request: Request,
        _rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        done(null, jwtSecret.getSecret());
      },
    });
  }

  validate(payload: JwtPayload) {
    if (payload.dibnovaAdmin) {
      return this.authService.toDibNovaAdminUser(payload.username);
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
