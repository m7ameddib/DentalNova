import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { GuarantorsService } from './guarantors.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
@Controller('guarantors')
export class GuarantorsController {
  constructor(private readonly guarantorsService: GuarantorsService) {}

  @Get()
  list() {
    return this.guarantorsService.list();
  }

  @Get('active')
  listActive() {
    return this.guarantorsService.listActive();
  }

  @Post()
  create(@Body('name') name: string) {
    return this.guarantorsService.create(name);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; isActive?: boolean }) {
    return this.guarantorsService.update(id, body);
  }

  @Get(':id/prices')
  listPrices(@Param('id', ParseIntPipe) id: number) {
    return this.guarantorsService.listPrices(id);
  }

  @Post(':id/prices')
  upsertPrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { treatmentTypeId: number; price: number },
  ) {
    return this.guarantorsService.upsertPrice(id, body.treatmentTypeId, body.price);
  }

  @Delete(':id/prices/:treatmentTypeId')
  deletePrice(@Param('id', ParseIntPipe) id: number, @Param('treatmentTypeId', ParseIntPipe) treatmentTypeId: number) {
    return this.guarantorsService.deletePrice(id, treatmentTypeId);
  }
}
