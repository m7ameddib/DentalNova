import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ReportPeriodDto } from '../reports/dto/report-period.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get()
  list(@Query() query: ReportPeriodDto, @Query('q') q?: string) {
    return this.expensesService.listForPeriod(query.from, query.to, q);
  }

  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.EXPENSES_MANAGE)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.remove(id);
  }
}
