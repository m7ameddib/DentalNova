import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PathsService } from '../common/paths.service';

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
    return this.config.get<string>('JWT_SECRET') || 'dev-secret';
  }
}
