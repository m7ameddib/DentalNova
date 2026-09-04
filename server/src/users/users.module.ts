import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, RolesRepository],
})
export class UsersModule {}
