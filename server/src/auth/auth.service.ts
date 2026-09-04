import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { AuthenticatedUser, JwtPayload } from './auth.types';
import { JwtSecretService } from './jwt-secret.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rolesRepo: RolesRepository,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly config: ConfigService,
  ) {}
  async validateCredentials(username: string, password: string): Promise<AuthenticatedUser> {
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

  toAuthenticatedUser(userId: number): AuthenticatedUser {
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
    };
  }

  login(authUser: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: authUser.id,
      username: authUser.username,
      roleName: authUser.roleName,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        secret: this.jwtSecret.getSecret(),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '12h',
      }),
      user: authUser,
    };
  }
}
