import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @Get()
  list(@Query('limit') limit?: string, @Query('patientId') patientId?: string) {
    const parsedLimit = limit ? Math.min(Number(limit) || 200, 500) : 200;
    const parsedPatientId = patientId ? Number(patientId) : undefined;
    if (parsedPatientId && !Number.isNaN(parsedPatientId)) {
      return this.auditService.forPatient(parsedPatientId, parsedLimit);
    }
    return this.auditService.recent(parsedLimit);
  }

  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @Get('patients/:patientId')
  forPatient(@Param('patientId', ParseIntPipe) patientId: number, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Number(limit) || 100, 500) : 100;
    return this.auditService.forPatient(patientId, parsedLimit);
  }
}
