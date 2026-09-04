import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  LinkAppointmentPatientDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/create-appointment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_VIEW)
  @Get('month')
  monthOverview(@Query('yearMonth') yearMonth: string) {
    return this.appointmentsService.getMonthOverview(yearMonth);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_VIEW)
  @Get()
  daySchedule(@Query('date') date: string) {
    return this.appointmentsService.getDaySchedule(date);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_CREATE)
  @Post()
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_EDIT)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.updateStatus(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_EDIT)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_EDIT)
  @Patch(':id/reminder-sent')
  recordReminderSent(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.recordReminderSent(id);
  }

  @RequirePermissions(PERMISSIONS.APPOINTMENTS_EDIT)
  @Patch(':id/link-patient')
  linkPatient(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkAppointmentPatientDto) {
    return this.appointmentsService.linkPatient(id, dto);
  }
}
