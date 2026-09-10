import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { LabCasesService } from './lab-cases.service';
import { CreateLabCaseDto, UpdateLabCaseDto } from './dto/lab-case.dto';
import { RecordLabPaymentDto, VoidLabPaymentDto } from './dto/lab-payment.dto';
import {
  RecordLabAccountPaymentDto,
  UpdateLabAccountPaymentDto,
  VoidLabAccountPaymentDto,
} from './dto/lab-account-payment.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { LabCaseListFilter } from '../database/repositories/lab-cases.repository';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.LAB_CASES_MANAGE)
@Controller('lab-cases')
export class LabCasesController {
  constructor(private readonly labCasesService: LabCasesService) {}

  @Get('work-types')
  workTypes() {
    return this.labCasesService.listWorkTypes();
  }

  @Get('lab-names')
  labNames() {
    return this.labCasesService.listLabNames();
  }

  @Get('lab-names/accounts')
  listLabAccounts() {
    return this.labCasesService.listLabAccounts();
  }

  @Get('lab-names/:id/service-costs')
  labServiceCosts(@Param('id', ParseIntPipe) id: number) {
    return this.labCasesService.listServiceCosts(id);
  }

  @Post('lab-names/:id/service-costs')
  upsertServiceCost(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { workTypeCode: string; cost: number },
  ) {
    return this.labCasesService.upsertServiceCost(id, body.workTypeCode, body.cost);
  }

  @Patch('lab-names/:id')
  updateLabName(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; phone?: string | null; isActive?: boolean },
  ) {
    return this.labCasesService.updateLabName(id, body);
  }

  @Delete('lab-names/:id')
  deleteLabName(@Param('id', ParseIntPipe) id: number) {
    return this.labCasesService.deleteLabName(id);
  }

  @Post('lab-names')
  createLabName(@Body() body: { name: string; phone: string }) {
    return this.labCasesService.createLabName(body.name, body.phone);
  }

  @Get('lab-names/:id/account')
  getLabAccount(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.labCasesService.getLabAccount(id, from, to);
  }

  @Get('lab-names/:id/account/orders')
  listLabAccountOrders(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.labCasesService.listLabAccountOrders(id, from, to);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Get('lab-names/:id/account/payments')
  listLabAccountPayments(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.labCasesService.listLabAccountPayments(id, from, to);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Get('lab-names/:id/account/statement')
  getLabStatement(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.labCasesService.getLabStatement(id, from, to);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Post('lab-names/:id/account/payments')
  recordLabAccountPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordLabAccountPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.recordLabAccountPayment(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Patch('lab-names/:id/account/payments/:paymentId')
  updateLabAccountPayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: UpdateLabAccountPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.updateLabAccountPayment(id, paymentId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_VOID)
  @Patch('lab-names/:id/account/payments/:paymentId/void')
  voidLabAccountPayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: VoidLabAccountPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.voidLabAccountPayment(id, paymentId, dto, user);
  }

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.labCasesService.summary(date);
  }

  @Get()
  list(@Query('filter') filter?: LabCaseListFilter, @Query('q') q?: string) {
    return this.labCasesService.list(filter, q);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.labCasesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateLabCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.labCasesService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLabCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Get(':id/payments')
  listPayments(@Param('id', ParseIntPipe) id: number) {
    return this.labCasesService.listPayments(id);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_RECORD)
  @Post(':id/payments')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordLabPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.recordPayment(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.LAB_PAYMENTS_VOID)
  @Patch(':id/payments/:paymentId/void')
  voidPayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: VoidLabPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labCasesService.voidPayment(id, paymentId, dto, user);
  }
}

