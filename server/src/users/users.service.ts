import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PlatformService } from '../platform/platform.service';
import { getTenantClinicId } from '../platform/tenant-context';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly rolesRepo: RolesRepository,
    private readonly platform: PlatformService,
  ) {}

  listUsers() {
    const roles = new Map(this.rolesRepo.findAll().map((r) => [r.id, r]));
    return this.usersRepo.findAll().map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      isActive: u.isActive,
      roleName: roles.get(u.roleId)?.name,
      roleLabel: roles.get(u.roleId)?.label,
    }));
  }

  listRoles() {
    return this.rolesRepo.findAll().map((role) => ({
      ...role,
      permissions: this.rolesRepo.getPermissionsForRole(role.id).map((p) => p.key),
    }));
  }

  async createUser(dto: CreateUserDto) {
    const role = this.rolesRepo.findByName(dto.roleName);
    if (!role) {
      throw new BadRequestException(`Unknown role "${dto.roleName}"`);
    }
    const clinicId = getTenantClinicId();
    if (this.platform.isEnabled()) {
      if (!clinicId) {
        throw new BadRequestException('Clinic context is required.');
      }
      if (this.platform.findUserByUsername(dto.username)) {
        throw new ConflictException('Username is already taken');
      }
    }
    if (this.usersRepo.findByUsername(dto.username)) {
      throw new ConflictException('Username is already taken');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      fullName: dto.fullName,
      username: dto.username,
      passwordHash,
      roleId: role.id,
    });
    if (this.platform.isEnabled() && clinicId) {
      this.platform.registerUser({
        username: dto.username,
        clinicId,
        userId: user.id,
      });
    }
    return { id: user.id, fullName: user.fullName, username: user.username, roleName: role.name };
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const existing = this.usersRepo.findById(id);
    if (!existing) throw new NotFoundException('User not found');

    let roleId: number | undefined;
    if (dto.roleName) {
      const role = this.rolesRepo.findByName(dto.roleName);
      if (!role) throw new BadRequestException(`Unknown role "${dto.roleName}"`);
      roleId = role.id;
    }
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const updated = this.usersRepo.update(id, {
      fullName: dto.fullName,
      roleId,
      isActive: dto.isActive,
      passwordHash,
    });
    const role = this.rolesRepo.findById(updated!.roleId);
    return {
      id: updated!.id,
      fullName: updated!.fullName,
      username: updated!.username,
      isActive: updated!.isActive,
      roleName: role?.name,
      roleLabel: role?.label,
    };
  }
}
