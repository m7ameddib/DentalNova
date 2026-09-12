import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { PatientsService } from './patients.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { LabCasesService } from '../lab-cases/lab-cases.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly followUpsService: FollowUpsService,
    private readonly labCasesService: LabCasesService,
  ) {}

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get('archived')
  listArchived() {
    return this.patientsService.listArchived();
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get()
  search(@Query('q') q?: string, @Query('includeArchived') includeArchived?: string) {
    return this.patientsService.search(q, includeArchived === '1' || includeArchived === 'true');
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get('check-phone')
  checkPhone(@Query('phone') phone: string) {
    return this.patientsService.checkPhone(phone);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getById(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_CREATE)
  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_EDIT)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_DELETE)
  @Patch(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.archive(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_DELETE)
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.restore(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_DELETE)
  @Delete(':id/permanent')
  deletePermanently(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.deletePermanently(id, user);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS_VIEW)
  @Get(':id/account-summary')
  accountSummary(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getAccountSummary(id);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_VIEW)
  @Get(':id/appointments/upcoming')
  upcomingAppointments(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getUpcomingAppointments(id);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_VIEW)
  @Get(':id/appointments')
  appointments(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getAppointments(id);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_VIEW)
  @Get(':id/treatments')
  treatments(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getTreatments(id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @Get(':id/payments')
  payments(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getPayments(id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @Get(':id/account-discounts')
  accountDiscounts(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getAccountDiscounts(id);
  }

  @RequirePermissions(PERMISSIONS.LAB_CASES_MANAGE)
  @Get(':id/lab-cases')
  labCases(@Param('id', ParseIntPipe) id: number) {
    return this.labCasesService.forPatient(id);
  }

  @RequirePermissions(PERMISSIONS.FOLLOWUPS_MANAGE)
  @Get(':id/follow-ups')
  followUps(@Param('id', ParseIntPipe) id: number) {
    return this.followUpsService.forPatient(id);
  }
}
