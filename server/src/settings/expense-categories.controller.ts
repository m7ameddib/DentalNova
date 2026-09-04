import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { ExpenseCategoriesService } from './expense-categories.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get()
  listActive() {
    return this.service.listActive();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('catalog')
  listCatalog() {
    return this.service.list();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post()
  create(@Body('label') label: string) {
    return this.service.create(label);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { label?: string; isActive?: boolean }) {
    return this.service.update(id, body);
  }
}
