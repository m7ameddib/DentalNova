import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { AuthenticatedUser } from '../auth/auth.types';

// Prescriptions are doctor-only end to end (create, view, print) — see
// PERMISSIONS.PRESCRIPTIONS_MANAGE, granted only to the "doctor" role.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients/:patientId/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Get()
  list(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.prescriptionsService.list(patientId);
  }

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Post()
  create(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prescriptionsService.create(patientId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.PRESCRIPTIONS_MANAGE)
  @Delete(':id')
  remove(@Param('patientId', ParseIntPipe) patientId: number, @Param('id', ParseIntPipe) id: number) {
    return this.prescriptionsService.remove(patientId, id);
  }
}
