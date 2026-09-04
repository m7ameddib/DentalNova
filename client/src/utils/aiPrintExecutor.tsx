import { TFunction } from 'i18next';
import { appointmentsApi } from '@/api/appointments.api';
import { patientsApi } from '@/api/patients.api';
import { reportsApi } from '@/api/reports.api';
import { areasApi } from '@/api/settings.api';
import { attachmentsApi } from '@/api/attachments.api';
import { AppointmentsPrintView } from '@/components/appointments/AppointmentsPrintView';
import { fetchPatientPrintSummary } from '@/components/appointments/printHelpers';
import { EMERGENCY_TYPE } from '@/components/appointments/constants';
import {
  AccountStatementPrintable,
  InvoiceReceiptPrintable,
  PatientFilePrintable,
} from '@/components/patient-record/PrintableTemplates';
import { ReportPrintable } from '@/components/reports/ReportPrintable';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { getPatientAreaDisplay } from '@/utils/patientArea';
import { timeToMinutes } from '@/utils/calendar';

export async function runAiClientPrint(
  action: string,
  params: Record<string, unknown>,
  deps: {
    print: (node: React.ReactNode) => void;
    language: string;
    t: TFunction;
  },
): Promise<void> {
  const { print, language, t } = deps;
  const clinic = await loadClinicPrintInfo();

  switch (action) {
    case 'print_patient_file': {
      const patientId = Number(params.patientId);
      const [patient, treatments, appointments, summary, attachments, areas] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.treatments(patientId),
        patientsApi.upcomingAppointments(patientId),
        patientsApi.accountSummary(patientId),
        attachmentsApi.list(patientId),
        areasApi.listActive(),
      ]);
      print(
        <PatientFilePrintable
          patient={patient}
          areaLabel={getPatientAreaDisplay(patient, areas)}
          treatments={treatments}
          appointments={appointments}
          summary={summary}
          attachments={attachments}
          clinic={clinic}
          language={language}
        />,
      );
      return;
    }
    case 'print_invoice': {
      const patientId = Number(params.patientId);
      const [patient, treatments, summary] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.treatments(patientId),
        patientsApi.accountSummary(patientId),
      ]);
      print(
        <InvoiceReceiptPrintable
          patient={patient}
          treatments={treatments}
          totals={{
            totalCostCents: summary.totalCostCents,
            totalPaidCents: summary.totalPaidCents,
            remainingCents: summary.remainingCents,
          }}
          clinic={clinic}
          language={language}
        />,
      );
      return;
    }
    case 'print_patient_report': {
      const patientId = Number(params.patientId);
      const [patient, treatments, payments, summary] = await Promise.all([
        patientsApi.getById(patientId),
        patientsApi.treatments(patientId),
        patientsApi.payments(patientId),
        patientsApi.accountSummary(patientId),
      ]);
      print(
        <AccountStatementPrintable
          patient={patient}
          treatments={treatments}
          payments={payments}
          totals={summary}
          clinic={clinic}
          language={language}
        />,
      );
      return;
    }
    case 'print_daily_appointments': {
      const date = String(params.date ?? todayIso());
      const schedule = await appointmentsApi.daySchedule(date);
      const appointments = schedule.appointments
        .filter((a) => a.status !== 'CANCELLED' && a.appointmentType !== EMERGENCY_TYPE)
        .slice()
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const emergencies = schedule.appointments
        .filter((a) => a.appointmentType === EMERGENCY_TYPE && a.status !== 'CANCELLED')
        .slice()
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const patientIds = [
        ...new Set(
          [...appointments, ...emergencies].map((a) => a.patientId).filter((id): id is number => !!id),
        ),
      ];
      const summaries = new Map<number, Awaited<ReturnType<typeof fetchPatientPrintSummary>>>();
      await Promise.all(
        patientIds.map(async (id) => {
          summaries.set(id, await fetchPatientPrintSummary(id));
        }),
      );
      print(
        <AppointmentsPrintView
          dateLabel={formatDateDisplay(date, language)}
          appointments={appointments}
          emergencies={emergencies}
          patientSummaries={summaries}
          language={language}
          clinic={clinic}
        />,
      );
      return;
    }
    case 'print_financial_report': {
      const from = String(params.from ?? todayIso());
      const to = String(params.to ?? todayIso());
      const summary = await reportsApi.summary(from, to);
      const periodLabel = from === to ? formatDateDisplay(from, language) : `${from} — ${to}`;
      const f = summary.financial;
      print(
        <ReportPrintable
          title={t('reports.financial.title')}
          periodLabel={periodLabel}
          clinic={clinic}
          language={language}
          columns={[]}
          rows={[]}
          totals={[
            { label: t('reports.financial.totalTreatmentValue'), value: formatMoney(f.totalTreatmentValueCents) },
            { label: t('reports.financial.totalDiscounts'), value: formatMoney(f.totalDiscountCents) },
            { label: t('reports.financial.totalCollected'), value: formatMoney(f.totalCollectedCents) },
            { label: t('reports.financial.outstandingBalance'), value: formatMoney(f.outstandingBalanceCents) },
            { label: t('reports.financial.totalExpenses'), value: formatMoney(f.totalExpensesCents) },
            { label: t('reports.financial.netCash'), value: formatMoney(f.netCashCents) },
          ]}
        />,
      );
      return;
    }
    default:
      throw new Error(`Unsupported print action: ${action}`);
  }
}
