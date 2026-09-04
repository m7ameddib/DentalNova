import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { MedicalAlertsService } from './medical-alerts.service';
import { ClinicalVisitNotesService } from './clinical-visit-notes.service';
import { CreateMedicalAlertDto } from './dto/create-medical-alert.dto';
import { UpdateMedicalAlertDto } from './dto/update-medical-alert.dto';
import { CreateClinicalVisitNoteDto } from './dto/create-clinical-visit-note.dto';
import { UpdateClinicalVisitNoteDto } from './dto/update-clinical-visit-note.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ClinicalController {
  constructor(
    private readonly medicalAlertsService: MedicalAlertsService,
    private readonly clinicalNotesService: ClinicalVisitNotesService,
  ) {}

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get('patients/:patientId/medical-alerts')
  listAlerts(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.medicalAlertsService.listForPatient(patientId, activeOnly === '1' || activeOnly === 'true');
  }

  @RequirePermissions(PERMISSIONS.MEDICAL_ALERTS_MANAGE)
  @Post('patients/:patientId/medical-alerts')
  createAlert(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateMedicalAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.medicalAlertsService.create(patientId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.MEDICAL_ALERTS_MANAGE)
  @Patch('medical-alerts/:id')
  updateAlert(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMedicalAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.medicalAlertsService.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.MEDICAL_ALERTS_MANAGE)
  @Patch('medical-alerts/:id/deactivate')
  deactivateAlert(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.medicalAlertsService.deactivate(id, user);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get('patients/:patientId/clinical-visit-notes')
  listNotes(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.clinicalNotesService.listForPatient(patientId);
  }

  @RequirePermissions(PERMISSIONS.CLINICAL_NOTES_MANAGE)
  @Post('patients/:patientId/clinical-visit-notes')
  createNote(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateClinicalVisitNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalNotesService.create(patientId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.CLINICAL_NOTES_MANAGE)
  @Patch('clinical-visit-notes/:id')
  updateNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClinicalVisitNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalNotesService.update(id, dto, user);
  }
}
