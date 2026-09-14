import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PathsService } from '../common/paths.service';
import { DEV_JWT_SECRET, isInsecureDevSecret } from './jwt-payload.util';

@Injectable()
export class JwtSecretService {
  private secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly paths: PathsService,
  ) {
    this.secret = this.readInitialSecret();
  }

  getSecret(): string {
    return this.secret;
  }

  /** Derived secret so password-reset tokens cannot be verified as session JWTs. */
  getResetSecret(): string {
    return createHash('sha256').update(`${this.getSecret()}|password-reset`).digest('hex');
  }

  /** Derived secret so Offline device credentials cannot be used as doctor sessions. */
  getDeviceSecret(): string {
    return createHash('sha256').update(`${this.getSecret()}|sync-device`).digest('hex');
  }

  isInsecureDevSecret(): boolean {
    return isInsecureDevSecret(this.secret);
  }

  /** Persist and apply immediately — no server restart required. */
  setSecret(next: string): void {
    this.paths.writeJwtSecret(next);
    this.secret = next;
  }

  reloadFromDisk(): void {
    this.secret = this.readInitialSecret();
  }

  private readInitialSecret(): string {
    const fromFile = this.paths.readJwtSecret();
    if (fromFile) return fromFile;
    return this.config.get<string>('JWT_SECRET') || DEV_JWT_SECRET;
  }
}
