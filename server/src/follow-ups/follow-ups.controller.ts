import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { RequirePermissions } from '../auth/decorators/permissions.decorator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { PERMISSIONS } from '../common/rbac.constants';

import { FollowUpType } from '../common/types';

import { FollowUpsService } from './follow-ups.service';

import { CreateFollowUpDto } from './dto/create-follow-up.dto';

import { CompleteFollowUpDto } from './dto/complete-follow-up.dto';

import { SetFollowUpDateDto } from './dto/set-follow-up-date.dto';

import { AddFollowUpNoteDto } from './dto/add-follow-up-note.dto';

import { UpdateFollowUpDto } from './dto/update-follow-up.dto';

import { FinancialActionDto } from './dto/financial-action.dto';

import { AuthenticatedUser } from '../auth/auth.types';



@UseGuards(JwtAuthGuard, PermissionsGuard)

@RequirePermissions(PERMISSIONS.FOLLOWUPS_MANAGE)

@Controller('follow-ups')

export class FollowUpsController {

  constructor(private readonly followUpsService: FollowUpsService) {}



  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.followUpsService.summary(date);
  }



  @Get('today')
  todaysWorkItems(@Query('date') date?: string) {
    return this.followUpsService.workItemsForDate(date);
  }



  @Get('history')

  history(@Query('patientId') patientId?: string) {

    return this.followUpsService.history(patientId ? Number(patientId) : undefined);

  }



  @Get()
  list(@Query('type') type?: FollowUpType, @Query('date') date?: string) {
    return this.followUpsService.list(type, date);
  }



  @Post()

  create(@Body() dto: CreateFollowUpDto, @CurrentUser() user: AuthenticatedUser) {

    return this.followUpsService.create(dto, user);

  }



  @Patch(':id')

  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFollowUpDto) {

    return this.followUpsService.update(id, dto);

  }



  @Patch(':id/date')

  setDate(

    @Param('id', ParseIntPipe) id: number,

    @Body() dto: SetFollowUpDateDto,

    @CurrentUser() user: AuthenticatedUser,

  ) {

    return this.followUpsService.setDate(id, dto, user);

  }



  @Patch(':id/note')

  addNote(

    @Param('id', ParseIntPipe) id: number,

    @Body() dto: AddFollowUpNoteDto,

    @CurrentUser() user: AuthenticatedUser,

  ) {

    return this.followUpsService.addNote(id, dto, user);

  }



  @Post(':id/complete')

  complete(

    @Param('id', ParseIntPipe) id: number,

    @Body() dto: CompleteFollowUpDto,

    @CurrentUser() user: AuthenticatedUser,

  ) {

    return this.followUpsService.complete(id, dto, user);

  }



  @Post(':id/financial-action')

  financialAction(

    @Param('id', ParseIntPipe) id: number,

    @Body() dto: FinancialActionDto,

    @CurrentUser() user: AuthenticatedUser,

  ) {

    return this.followUpsService.financialAction(id, dto, user);

  }

}

