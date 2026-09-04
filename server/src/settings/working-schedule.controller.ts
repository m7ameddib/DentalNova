import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { WorkingScheduleService } from './working-schedule.service';
import {
  CreateScheduleExceptionDto,
  SaveWeeklyScheduleDto,
  UpdateScheduleExceptionDto,
} from './dto/working-schedule.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/working-schedule')
export class WorkingScheduleController {
  constructor(private readonly scheduleService: WorkingScheduleService) {}

  @Get('weekly')
  getWeekly() {
    return this.scheduleService.getWeeklySchedule();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('weekly')
  saveWeekly(@Body() dto: SaveWeeklyScheduleDto) {
    const days = dto.days.map((d, idx) => ({
      dayOfWeek: d.dayOfWeek ?? idx,
      isOpen: d.isOpen,
      periods: d.periods,
    }));
    return this.scheduleService.saveWeeklySchedule(days);
  }

  @Get('exceptions')
  listExceptions() {
    return this.scheduleService.listExceptions();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('exceptions')
  createException(@Body() dto: CreateScheduleExceptionDto) {
    return this.scheduleService.createException(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('exceptions/:id')
  updateException(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduleExceptionDto) {
    return this.scheduleService.updateException(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete('exceptions/:id')
  deleteException(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleService.deleteException(id);
  }
}
