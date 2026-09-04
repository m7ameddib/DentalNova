import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('users')
  list() {
    return this.usersService.listUsers();
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post('users')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Patch('users/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @Get('roles')
  roles() {
    return this.usersService.listRoles();
  }
}
