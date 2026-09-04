import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('areas')
export class AreasController {
  constructor(private readonly service: AreasService) {}

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get()
  listActive() {
    return this.service.listActive();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('catalog')
  listAll() {
    return this.service.listAll();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post()
  create(@Body() dto: CreateAreaDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAreaDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
