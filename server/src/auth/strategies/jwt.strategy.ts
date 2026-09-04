import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../auth.types';
import { JwtSecretService } from '../jwt-secret.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtSecret: JwtSecretService,
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
    try {
      return this.authService.toAuthenticatedUser(payload.sub);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
