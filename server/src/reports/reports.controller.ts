import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/rbac.constants';
import { ReportsService } from './reports.service';
import { ReportPeriodDto } from './dto/report-period.dto';
import { AppointmentStatus } from '../common/types';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Employees can view the whole Reports page except the Financial Summary
  // section: general "reports.view" gates the page + summary + the
  // Appointments/Patients Summary drill-downs. The doctor-only
  // "reports.financial.view" gates only the Financial Summary section and
  // its treatment/payment/outstanding drill-downs.

  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get('summary')
  summary(@Query() query: ReportPeriodDto) {
    return this.reportsService.getSummary(query);
  }

  /** Treatment Value / Discounts drill-down. `onlyDiscounted=true` filters to Discount > 0. */
  @RequirePermissions(PERMISSIONS.REPORTS_FINANCIAL_VIEW)
  @Get('treatments')
  treatments(@Query() query: ReportPeriodDto, @Query('onlyDiscounted') onlyDiscounted?: string) {
    return this.reportsService.getTreatmentsDetail(query, onlyDiscounted === 'true');
  }

  /** Collected Payments drill-down. */
  @RequirePermissions(PERMISSIONS.REPORTS_FINANCIAL_VIEW)
  @Get('payments')
  payments(@Query() query: ReportPeriodDto) {
    return this.reportsService.getPaymentsDetail(query);
  }

  /** Outstanding Balance drill-down (clinic-wide, not period-bound). */
  @RequirePermissions(PERMISSIONS.REPORTS_FINANCIAL_VIEW)
  @Get('outstanding')
  outstanding() {
    return this.reportsService.getOutstandingDetail();
  }

  /** Patient debts with follow-up dates (Financial Summary card). */
  @RequirePermissions(PERMISSIONS.REPORTS_FINANCIAL_VIEW)
  @Get('debts')
  debts() {
    return this.reportsService.getDebtsDetail();
  }

  /** Appointments Summary drill-down, optionally filtered to a single status. */
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get('appointments')
  appointments(@Query() query: ReportPeriodDto, @Query('status') status?: AppointmentStatus) {
    return this.reportsService.getAppointmentsDetail(query, status);
  }

  /** Patients Summary drill-down. `onlyNew=true` respects the selected period; otherwise all patients. */
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get('patients')
  patients(@Query() query: ReportPeriodDto, @Query('onlyNew') onlyNew?: string) {
    return this.reportsService.getPatientsDetail(query, onlyNew === 'true');
  }

  /** End-of-day clinic summary for the Daily Report page. */
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @Get('daily')
  daily(@Query('date') date?: string) {
    return this.reportsService.getDailyReport(date);
  }
}
