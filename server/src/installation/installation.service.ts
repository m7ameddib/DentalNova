import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { InstallationRepository, InstallationPhase } from './installation.repository';
import { LicenseService } from '../common/license.service';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { AuthService } from '../auth/auth.service';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { DatabaseService } from '../database/database.service';
import { PathsService } from '../common/paths.service';
import { DeploymentService } from '../common/deployment.service';
import { ConfigService } from '@nestjs/config';
import { ActivateLicenseDto, ActivateOnlineDto, FirstSetupDto } from './dto/installation.dto';
import { APP_VERSION } from '../common/version';
import { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionRepository } from '../subscription/subscription.repository';
import { OnlineClinicAccountsRepository } from '../database/repositories/online-clinic-accounts.repository';
import { isValidPhone, normalizePhone } from '../common/phone.util';

export interface InstallationStatusResponse {
  phase: InstallationPhase;
  installationId: string;
  version: string;
  product: string;
  deploymentMode: 'offline' | 'online';
  onlineSubscriptionStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | null;
}

export interface SetupCompleteResponse extends InstallationStatusResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class InstallationService {
  private readonly logger = new Logger(InstallationService.name);

  constructor(
    private readonly repo: InstallationRepository,
    private readonly license: LicenseService,
    private readonly jwtSecret: JwtSecretService,
    private readonly authService: AuthService,
    private readonly clinicSettings: ClinicSettingsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly rolesRepo: RolesRepository,
    private readonly db: DatabaseService,
    private readonly paths: PathsService,
    private readonly deployment: DeploymentService,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly onlineAccountsRepo: OnlineClinicAccountsRepository,
    private readonly config: ConfigService,
  ) {}

  getStatus(): InstallationStatusResponse {
    const row = this.repo.get();
    const sub = this.deployment.isOnline() ? this.subscriptionRepo.get() : null;
    return {
      phase: this.repo.phase(),
      installationId: row.installationId,
      version: APP_VERSION,
      product: 'DNT Dental',
      deploymentMode: this.deployment.getMode(),
      onlineSubscriptionStatus: sub?.status ?? null,
    };
  }

  activate(dto: ActivateLicenseDto) {
    this.assertCanActivateOffline();
    return this.applyLicense(dto.license.trim());
  }

  async activateOnline(dto: ActivateOnlineDto) {
    this.assertCanActivateOffline();

    const row = this.repo.get();
    const licensingBase =
      this.config.get<string>('DIBNOVA_LICENSING_URL')?.trim() || 'https://dental.dibnova.com';
    const url = `${licensingBase.replace(/\/$/, '')}/api/licensing/offline-activate`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': `DentalNova-Offline/${APP_VERSION}`,
        },
        body: JSON.stringify({
          installationId: row.installationId,
          activationCode: dto.activationCode.trim(),
          clinicName: dto.clinicName?.trim() || undefined,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const msg = (err as Error).message ?? 'Network error';
      this.logger.warn(`Online activation request failed: ${msg}`);
      throw new BadRequestException(
        'Could not connect to DibNova licensing server. Check your internet connection and try again, or use manual license key activation.',
      );
    }

    let body: { license?: string; message?: string | string[] };
    try {
      body = (await res.json()) as { license?: string; message?: string | string[] };
    } catch {
      throw new BadRequestException(
        'DibNova licensing server returned an invalid response. Use manual license key activation.',
      );
    }

    if (!res.ok || !body.license?.trim()) {
      const remoteMsg = body.message;
      const message = Array.isArray(remoteMsg)
        ? remoteMsg.join(', ')
        : remoteMsg ||
          'Online activation was rejected. Verify your activation code or use manual license key activation.';
      throw new BadRequestException(message);
    }

    return this.applyLicense(body.license.trim());
  }

  private assertCanActivateOffline(): void {
    if (!this.deployment.requiresLicense()) {
      throw new ConflictException('License activation is not required in online deployment mode.');
    }
    if (this.repo.phase() !== 'activation') {
      throw new ConflictException('License is already activated on this installation.');
    }
  }

  private applyLicense(trimmed: string) {
    const dot = trimmed.lastIndexOf('.');
    if (dot <= 0) {
      throw new BadRequestException('Invalid license format.');
    }

    const payloadJson = Buffer.from(trimmed.slice(0, dot), 'base64url').toString('utf-8');
    const signaturePart = trimmed.slice(dot + 1);
    const payload = this.license.parseAndVerify(trimmed);

    const row = this.repo.get();
    if (payload.installationId !== row.installationId) {
      throw new BadRequestException(
        'This license is bound to a different clinic installation.',
      );
    }

    this.repo.saveLicense(payloadJson, signaturePart);
    this.logger.log(`License activated for clinic ${payload.clinicId}`);
    return this.getStatus();
  }

  async completeSetup(dto: FirstSetupDto): Promise<SetupCompleteResponse> {
    if (this.repo.phase() !== 'setup') {
      throw new ConflictException('Clinic setup has already been completed.');
    }

    const username = dto.adminUsername.trim();
    const phoneNormalized = normalizePhone(dto.adminPhone);

    if (!isValidPhone(dto.adminPhone)) {
      throw new BadRequestException('Enter a valid administrator phone number.');
    }

    if (this.usersRepo.findByUsername(username)) {
      throw new ConflictException('Username is already taken.');
    }

    if (this.usersRepo.findByPhoneNormalized(phoneNormalized)) {
      throw new ConflictException('This phone number is already registered to another account.');
    }

    const installationRow = this.repo.get();

    if (this.deployment.isOnline()) {
      if (this.onlineAccountsRepo.findByUsername(username)) {
        throw new ConflictException('Username is already taken.');
      }
      if (this.onlineAccountsRepo.findByPhoneNormalized(phoneNormalized)) {
        throw new ConflictException('This phone number is already registered to another clinic account.');
      }
    }

    const doctorRole = this.rolesRepo.findByName('doctor');
    if (!doctorRole) {
      throw new BadRequestException('System roles are not initialized.');
    }

    const jwtSecret = crypto.randomBytes(48).toString('base64url');
    this.paths.ensureDataDirs();
    this.jwtSecret.setSecret(jwtSecret);

    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
    const created = this.db.connection.transaction(() => {
      this.clinicSettings.update({
        clinicName: dto.clinicName.trim(),
        clinicPhone: dto.clinicPhone.trim(),
        doctorPhone: dto.doctorPhone.trim(),
        address: dto.address?.trim() || null,
        workingDays: dto.workingDays,
        workStartTime: dto.workStartTime,
        workEndTime: dto.workEndTime,
      });

      const user = this.usersRepo.create({
        fullName: dto.doctorName.trim(),
        username,
        passwordHash,
        roleId: doctorRole.id,
        phone: dto.adminPhone.trim(),
        phoneNormalized,
      });

      if (this.deployment.isOnline()) {
        this.onlineAccountsRepo.create({
          username,
          phoneNormalized,
          installationId: installationRow.installationId,
          adminUserId: user.id,
        });
      }

      this.repo.markSetupComplete();
      if (this.deployment.isOnline()) {
        this.repo.markOnlineSubscriptionPending();
        this.logger.log('Online clinic setup complete — subscription PENDING admin activation.');
      }
      return user;
    })();
    this.logger.log('First clinic setup completed.');

    const authUser = this.authService.toAuthenticatedUser(created.id);
    const session = this.authService.login(authUser);
    return {
      ...this.getStatus(),
      ...session,
    };
  }

  isReady(): boolean {
    return this.repo.phase() === 'ready';
  }
}
