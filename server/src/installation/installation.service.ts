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
import { ActivateLicenseDto, FirstSetupDto } from './dto/installation.dto';
import { APP_VERSION } from '../common/version';
import { AuthenticatedUser } from '../auth/auth.types';

export interface InstallationStatusResponse {
  phase: InstallationPhase;
  installationId: string;
  version: string;
  product: string;
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
  ) {}

  getStatus(): InstallationStatusResponse {
    const row = this.repo.get();
    return {
      phase: this.repo.phase(),
      installationId: row.installationId,
      version: APP_VERSION,
      product: 'DNT Dental',
    };
  }

  activate(dto: ActivateLicenseDto) {
    if (this.repo.phase() !== 'activation') {
      throw new ConflictException('License is already activated on this installation.');
    }

    const trimmed = dto.license.trim();
    const dot = trimmed.lastIndexOf('.');
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

    if (this.usersRepo.findByUsername(dto.adminUsername)) {
      throw new ConflictException('Username is already taken.');
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
        username: dto.adminUsername.trim(),
        passwordHash,
        roleId: doctorRole.id,
      });

      this.repo.markSetupComplete();
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
