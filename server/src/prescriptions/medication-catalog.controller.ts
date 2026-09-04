import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { MedicationCatalogService } from './medication-catalog.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

// The Medication Catalog only exists to feed the doctor-only Prescription
// screen's medication buttons, so it reuses PERMISSIONS.PRESCRIPTIONS_MANAGE
// end to end rather than introducing a separate permission.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medication-catalog')
export class MedicationCatalogController {
  constructor(private readonly service: MedicationCatalogService) {}

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Get()
  list() {
    return this.service.list();
  }

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Post()
  create(@Body() dto: CreateMedicationDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMedicationDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
