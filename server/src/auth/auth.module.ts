import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { JwtSecretService } from './jwt-secret.service';
import { PathsService } from '../common/paths.service';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [
    PathsService,
    JwtSecretService,
    AuthService,
    JwtStrategy,
    PermissionsGuard,
    UsersRepository,
    RolesRepository,
  ],
  controllers: [AuthController],
  exports: [AuthService, PermissionsGuard, JwtSecretService],
})
export class AuthModule {}
