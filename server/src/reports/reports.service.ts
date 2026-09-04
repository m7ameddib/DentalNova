import { Injectable } from '@nestjs/common';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { FollowUpsRepository } from '../database/repositories/follow-ups.repository';
import { LabCasesRepository } from '../database/repositories/lab-cases.repository';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { AppointmentStatus } from '../common/types';
import { ReportPeriodDto } from './dto/report-period.dto';
import { addLocalDays, localTodayIso } from '../common/local-date.util';

const STATUS_LIST: AppointmentStatus[] = ['SCHEDULED', 'WAITING', 'IN_TREATMENT', 'COMPLETED', 'CANCELLED'];

function todayIso(): string {
  return localTodayIso();
}

function addDays(isoDate: string, days: number): string {
  return addLocalDays(isoDate, days);
}

function mapDailyAppointmentRow(a: {
  id: number;
  time: string;
  patientName?: string | null;
  guestName?: string | null;
  reason: string | null;
  durationMin: number;
  status: AppointmentStatus;
}) {
  return {
    id: a.id,
    time: a.time,
    patientName: a.patientName ?? a.guestName ?? '',
    reason: a.reason,
    durationMin: a.durationMin,
    status: a.status,
  };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly treatmentsRepo: PatientTreatmentsRepository,
    private readonly paymentsRepo: PaymentsRepository,
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly expensesRepo: ClinicExpensesRepository,
    private readonly followUpsRepo: FollowUpsRepository,
    private readonly followUpsService: FollowUpsService,
    private readonly labCasesRepo: LabCasesRepository,
  ) {}

  private resolvePeriod(query: ReportPeriodDto) {
    const from = query.from ?? todayIso();
    const to = query.to ?? todayIso();
    return { from, to };
  }

  getSummary(query: ReportPeriodDto) {
    const { from, to } = this.resolvePeriod(query);

    const treatmentTotals = this.treatmentsRepo.sumForPeriod(from, to);
    const collectedForPeriod = this.paymentsRepo.totalForPeriod(from, to);
    const outstandingBalanceCents = Math.max(
      0,
      this.treatmentsRepo.totalFinalAmountAll() -
        this.patientsRepo.totalAccountDiscountAll() -
        this.paymentsRepo.totalPaidAll(),
    );
    const totalExpensesCents = this.expensesRepo.totalForPeriod(from, to);
    const netCashCents = collectedForPeriod - totalExpensesCents;

    const statusCounts = this.appointmentsRepo.countByStatusForPeriod(from, to);
    const countsByStatus = new Map(statusCounts.map((s) => [s.status, s.count]));
    const appointmentsTotal = statusCounts.reduce((sum, s) => sum + s.count, 0);

    return {
      period: { from, to },
      financial: {
        totalTreatmentValueCents: treatmentTotals.baseCents,
        totalDiscountCents: treatmentTotals.discountCents,
        totalCollectedCents: collectedForPeriod,
        outstandingBalanceCents,
        totalExpensesCents,
        netCashCents,
      },
      appointments: {
        total: appointmentsTotal,
        ...Object.fromEntries(
          STATUS_LIST.map((s) => [s.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase()), countsByStatus.get(s) ?? 0]),
        ),
      },
      patients: {
        totalPatients: this.patientsRepo.countAll(),
        newPatients: this.patientsRepo.countCreatedForPeriod(from, to),
      },
    };
  }

  // ---- Drill-down detail lists (all respect the same selected period) ----

  getTreatmentsDetail(query: ReportPeriodDto, onlyDiscounted: boolean) {
    const { from, to } = this.resolvePeriod(query);
    const rows = this.treatmentsRepo.findForPeriodWithPatient(from, to);
    return onlyDiscounted ? rows.filter((r) => r.discountCents > 0) : rows;
  }

  getPaymentsDetail(query: ReportPeriodDto) {
    const { from, to } = this.resolvePeriod(query);
    return this.paymentsRepo.findForPeriodWithPatient(from, to);
  }

  getOutstandingDetail() {
    return this.patientsRepo.findOutstanding();
  }

  /** Patient debts with last payment and next financial follow-up date. */
  getDebtsDetail() {
    this.followUpsService.syncFinancialFollowUps();
    const outstanding = this.patientsRepo.findOutstanding();
    return outstanding.map((p) => {
      const payments = this.paymentsRepo.findByPatient(p.id, 1);
      const last = payments[0];
      const financialFu = this.followUpsRepo.findActiveFinancialByPatient(p.id);
      return {
        ...p,
        lastPaymentDate: last?.date ?? null,
        lastPaymentAmountCents: last?.amountCents ?? null,
        nextFollowUpDate: financialFu?.followUpDate ?? null,
      };
    });
  }

  getAppointmentsDetail(query: ReportPeriodDto, status?: AppointmentStatus) {
    const { from, to } = this.resolvePeriod(query);
    return this.appointmentsRepo.findForPeriodDetailed(from, to, status);
  }

  getPatientsDetail(query: ReportPeriodDto, onlyNew: boolean) {
    const { from, to } = this.resolvePeriod(query);
    return onlyNew ? this.patientsRepo.findCreatedForPeriod(from, to) : this.patientsRepo.findAll(100000);
  }

  getDailyReport(date?: string) {
    const reportDate = date?.slice(0, 10) ?? localTodayIso();
    const tomorrow = addLocalDays(reportDate, 1);

    this.followUpsService.syncFinancialFollowUps();

    const newPatients = this.patientsRepo.findCreatedForLocalDate(reportDate);
    const payments = this.paymentsRepo.findForPeriodWithPatient(reportDate, reportDate);
    const paymentsTotalCents = payments.reduce((sum, p) => sum + p.amountCents, 0);

    const historyToday = this.followUpsRepo.findHistoryForLocalDate(reportDate);
    const completedFollowUpIds = new Set(
      historyToday.map((h) => h.followUpId).filter((id): id is number => id != null),
    );

    const pendingActive = this.followUpsRepo.findAllActive().filter(
      (fu) =>
        fu.status === 'ACTIVE' &&
        fu.followUpDate <= reportDate &&
        !completedFollowUpIds.has(fu.id),
    );

    const followUpsFromHistory = historyToday.map((h) => ({
      id: h.id,
      patientId: h.patientId,
      patientName: h.patientName ?? '',
      type: h.type,
      reason: h.reason,
      result: h.result,
      note: h.note,
      status: 'COMPLETED' as const,
      paymentAmountCents: h.paymentAmountCents,
      appointmentSummary: h.appointmentSummary,
      nextFollowUpDate: h.nextFollowUpDate,
      createdAt: h.createdAt,
    }));

    const followUpsPending = pendingActive.map((fu) => ({
      id: fu.id,
      patientId: fu.patientId,
      patientName: fu.patientName,
      type: fu.type,
      reason: fu.reason,
      result: null,
      note: fu.note,
      status: 'PENDING' as const,
      queueCategory: fu.followUpDate === reportDate ? ('DUE' as const) : ('OVERDUE' as const),
      paymentAmountCents: null,
      appointmentSummary: null,
      nextFollowUpDate: fu.followUpDate,
      createdAt: fu.createdAt,
    }));

    const followUpsDueToday = followUpsPending.filter((fu) => fu.queueCategory === 'DUE');
    const followUpsOverdue = followUpsPending.filter((fu) => fu.queueCategory === 'OVERDUE');

    const followUps = [...followUpsFromHistory, ...followUpsPending];
    const todayAppointments = this.appointmentsRepo
      .findForPeriodDetailed(reportDate, reportDate)
      .map((a) => mapDailyAppointmentRow(a as any));
    const tomorrowAppointments = this.appointmentsRepo.findByDate(tomorrow).map((a) => mapDailyAppointmentRow(a as any));

    const labSummary = this.labCasesRepo.summaryForDate(reportDate);
    const labCasesDue = this.labCasesRepo.findDueForDailyReport(reportDate).map((c) => ({
      id: c.id,
      patientId: c.patientId,
      patientName: c.patientName,
      labName: c.labName,
      workTypeLabel: c.workTypeLabel,
      teeth: c.teeth,
      expectedDeliveryDate: c.expectedDeliveryDate,
      status: c.status,
      dueAlert: c.dueAlert,
    }));

    const expenses = this.expensesRepo.findForPeriod(reportDate, reportDate);
    const cashPayments = payments.filter(
      (p) => p.method === 'CASH' && (p.status ?? 'ACTIVE') !== 'VOID',
    );
    const cashExpenses = expenses.filter((e) => e.paymentMethod === 'CASH' && (e.status ?? 'ACTIVE') !== 'VOID');
    const cashInCents = cashPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const cashOutCents = cashExpenses.reduce((sum, e) => sum + e.amountCents, 0);
    const cashMovements = [
      ...cashPayments.map((p) => ({
        kind: 'IN' as const,
        amountCents: p.amountCents,
        label: p.patientName,
        detail: p.methodLabel ?? p.method,
        time: p.createdAt,
      })),
      ...cashExpenses.map((e) => ({
        kind: 'OUT' as const,
        amountCents: e.amountCents,
        label: e.note?.trim() || e.category,
        detail: e.category,
        time: e.createdAt,
      })),
    ].sort((a, b) => String(a.time).localeCompare(String(b.time)));

    return {
      date: reportDate,
      generatedAt: new Date().toISOString(),
      summary: {
        newPatientsCount: newPatients.length,
        paymentsCount: payments.length,
        paymentsTotalCents,
        followUpsTotal: followUps.length,
        followUpsCompleted: followUpsFromHistory.length,
        followUpsPending: followUpsPending.length,
        followUpsDueToday: followUpsDueToday.length,
        followUpsOverdue: followUpsOverdue.length,
        labCasesDueToday: labSummary.dueToday,
        labCasesOverdue: labSummary.overdue,
        tomorrowAppointmentsCount: tomorrowAppointments.length,
      },
      newPatients,
      payments: payments.map((p) => ({
        id: p.id,
        patientId: p.patientId,
        patientName: p.patientName,
        amountCents: p.amountCents,
        method: p.method,
        methodLabel: (p as any).methodLabel,
        date: p.date,
        createdAt: p.createdAt,
      })),
      followUps,
      labCasesDue,
      todayAppointments,
      tomorrowAppointments,
      cashReport: {
        cashInCents,
        cashOutCents,
        balanceCents: cashInCents - cashOutCents,
        movements: cashMovements,
      },
    };
  }
}
