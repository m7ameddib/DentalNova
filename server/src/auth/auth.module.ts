import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordResetService } from './password-reset.service';
import { SmsService } from './sms.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { PasswordResetRepository } from '../database/repositories/password-reset.repository';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { OnlineClinicAccountsRepository } from '../database/repositories/online-clinic-accounts.repository';
import { JwtSecretService } from './jwt-secret.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { PathsService } from '../common/paths.service';
import { DeploymentService } from '../common/deployment.service';
import { InstallationModule } from '../installation/installation.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.register({}),
    forwardRef(() => InstallationModule),
  ],
  providers: [
    PathsService,
    JwtSecretService,
    DeploymentService,
    AuthService,
    PasswordResetService,
    SmsService,
    JwtStrategy,
    AuthRateLimitService,
    PermissionsGuard,
    UsersRepository,
    RolesRepository,
    PasswordResetRepository,
    ClinicSettingsRepository,
    OnlineClinicAccountsRepository,
  ],
  controllers: [AuthController],
  exports: [AuthService, PermissionsGuard, JwtSecretService, PasswordResetService],
})
export class AuthModule {}
