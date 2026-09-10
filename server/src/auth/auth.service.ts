import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { InstallationRepository } from '../installation/installation.repository';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { JwtSecretService } from './jwt-secret.service';
import { PERMISSIONS } from '../common/rbac.constants';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from '../platform/platform.service';
import { bindTenant, runInTenant } from '../platform/tenant-context';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rolesRepo: RolesRepository,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly config: ConfigService,
    private readonly deployment: DeploymentService,
    private readonly installationRepo: InstallationRepository,
    private readonly platform: PlatformService,
  ) {}

  async validateCredentials(username: string, password: string): Promise<AuthenticatedUser> {
    if (this.platform.isEnabled()) {
      const directory = this.platform.findUserByUsername(username);
      if (!directory) {
        throw new UnauthorizedException('Invalid username or password');
      }
      return runInTenant(directory.clinicId, async () => {
        bindTenant(directory.clinicId);
        const user = await this.validateLocalCredentials(username, password);
        return { ...user, clinicId: directory.clinicId };
      });
    }
    return this.validateLocalCredentials(username, password);
  }

  private async validateLocalCredentials(username: string, password: string): Promise<AuthenticatedUser> {
    const user = this.usersRepo.findByUsername(username);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.toAuthenticatedUser(user.id);
  }

  toAuthenticatedUser(userId: number, clinicId?: string): AuthenticatedUser {
    const user = this.usersRepo.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const role = this.rolesRepo.findById(user.roleId);
    const permissions = role ? this.rolesRepo.getPermissionsForRole(role.id).map((p) => p.key) : [];
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      isActive: user.isActive,
      roleId: user.roleId,
      roleName: role?.name ?? 'unknown',
      roleLabel: role?.label ?? 'Unknown',
      permissions,
      clinicId,
    };
  }

  login(authUser: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: authUser.id,
      username: authUser.username,
      roleName: authUser.roleName,
    };

    if (this.deployment.isOnline()) {
      payload.clinicId = authUser.clinicId;
      payload.installationId = authUser.clinicId ?? this.installationRepo.get().installationId;
    }

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.jwtSecret.getSecret(),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '12h',
      }),
      user: authUser,
    };
  }

  toDibNovaAdminUser(username: string): AuthenticatedUser {
    return {
      id: 0,
      fullName: 'DibNova Administrator',
      username,
      isActive: true,
      roleId: 0,
      roleName: 'dibnova_admin',
      roleLabel: 'DibNova Admin',
      permissions: [PERMISSIONS.DIBNOVA_ADMIN],
    };
  }

  loginDibNovaAdmin(username: string, password: string) {
    if (!this.isDibNovaAdminConfigured()) {
      throw new ServiceUnavailableException('DibNova admin login is not configured on this server.');
    }
    if (!this.validateDibNovaAdminCredentials(username, password)) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const authUser = this.toDibNovaAdminUser(username.trim());
    const payload: JwtPayload = {
      sub: 0,
      username: authUser.username,
      roleName: authUser.roleName,
      dibnovaAdmin: true,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.jwtSecret.getSecret(),
        expiresIn: this.config.get<string>('DIBNOVA_ADMIN_JWT_EXPIRES_IN') || '8h',
      }),
      user: authUser,
    };
  }

  isDibNovaAdminConfigured(): boolean {
    const user = this.config.get<string>('DIBNOVA_ADMIN_USERNAME')?.trim();
    const pass = this.config.get<string>('DIBNOVA_ADMIN_PASSWORD');
    return Boolean(user && pass);
  }

  private validateDibNovaAdminCredentials(username: string, password: string): boolean {
    const expectedUser = this.config.get<string>('DIBNOVA_ADMIN_USERNAME')?.trim();
    const expectedPass = this.config.get<string>('DIBNOVA_ADMIN_PASSWORD') ?? '';
    if (!expectedUser || !expectedPass) return false;
    if (username.trim() !== expectedUser) return false;
    return this.timingSafeEqual(password, expectedPass);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
