import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { TreatmentsService } from './treatments.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { CreateTreatmentTypeDto } from './dto/create-treatment-type.dto';
import { UpdateTreatmentTypeDto } from './dto/update-treatment-type.dto';
import { UpdateTreatmentStatusDto } from './dto/update-treatment-status.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @RequirePermissions(PERMISSIONS.TREATMENTS_VIEW)
  @Get('treatment-types')
  listTypes() {
    return this.treatmentsService.listTreatmentTypes();
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  @Get('treatment-types/catalog')
  listCatalog() {
    return this.treatmentsService.listTreatmentCatalog();
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  @Post('treatment-types')
  createType(@Body() dto: CreateTreatmentTypeDto) {
    return this.treatmentsService.createTreatmentType(dto);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_MANAGE)
  @Patch('treatment-types/:id')
  updateType(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTreatmentTypeDto) {
    return this.treatmentsService.updateTreatmentType(id, dto);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_CREATE)
  @Post('treatments')
  create(@Body() dto: CreateTreatmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentsService.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_CREATE)
  @Delete('treatments/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentsService.remove(id, user);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_CREATE)
  @Patch('treatments/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treatmentsService.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.TREATMENTS_CREATE)
  @Patch('treatments/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTreatmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treatmentsService.updateStatus(id, dto, user);
  }
}
