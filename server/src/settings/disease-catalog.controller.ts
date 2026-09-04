import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { DiseaseCatalogService } from './disease-catalog.service';
import { CreateDiseaseCatalogDto, UpdateDiseaseCatalogDto } from './dto/disease-catalog.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('disease-catalog')
export class DiseaseCatalogController {
  constructor(private readonly service: DiseaseCatalogService) {}

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
  create(@Body() dto: CreateDiseaseCatalogDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDiseaseCatalogDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
