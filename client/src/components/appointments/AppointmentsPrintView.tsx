import { useTranslation } from 'react-i18next';
import {
  PrintDocument,
  PrintFooter,
  PrintMetaItem,
  PrintMetaRow,
  PrintReportHeader,
  PrintSection,
  PrintTable,
} from '@/components/common/PrintLayout';
import { AppointmentWithPatient } from '@/types/domain';
import { formatClockTime, minutesToTime, timeToMinutes } from '@/utils/calendar';
import { ClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { PatientPrintSummary } from './printHelpers';

interface AppointmentsPrintViewProps {
  dateLabel: string;
  appointments: AppointmentWithPatient[];
  emergencies: AppointmentWithPatient[];
  patientSummaries: Map<number, PatientPrintSummary>;
  language: string;
  clinic: ClinicPrintInfo;
}

function calendarStatusKey(status: string): string {
  if (status === 'SCHEDULED') return 'appointmentsPage.statusCalendar.ARRIVED';
  if (status === 'WAITING') return 'appointmentsPage.statusCalendar.WAITING';
  if (status === 'IN_TREATMENT') return 'appointmentsPage.statusCalendar.IN_TREATMENT';
  if (status === 'CANCELLED') return 'appointmentsPage.statusCalendar.CANCELLED';
  return `appointmentsPage.status.${status}`;
}

function PatientSummaryCells({
  appt,
  summaries,
  language,
  t,
}: {
  appt: AppointmentWithPatient;
  summaries: Map<number, PatientPrintSummary>;
  language: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (!appt.patientId) {
    return (
      <>
        <td>—</td>
        <td>—</td>
      </>
    );
  }

  const summary = summaries.get(appt.patientId);
  const lastTreatment =
    summary?.lastTreatmentLabel && summary.lastTreatmentDate
      ? `${summary.lastTreatmentLabel} (${formatDateDisplay(summary.lastTreatmentDate, language)})`
      : summary?.lastTreatmentLabel ?? '—';

  const balance =
    summary && summary.remainingCents > 0
      ? formatMoney(summary.remainingCents)
      : t('appointmentsPage.print.paid');

  return (
    <>
      <td>{lastTreatment}</td>
      <td>{balance}</td>
    </>
  );
}

function PrintAppointmentTable({
  rows,
  summaries,
  language,
  t,
}: {
  rows: AppointmentWithPatient[];
  summaries: Map<number, PatientPrintSummary>;
  language: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (rows.length === 0) {
    return <p className="print-section__empty">{t('appointmentsPage.print.noEntries')}</p>;
  }

  return (
    <PrintTable compact>
      <thead>
        <tr>
          <th>{t('common.time')}</th>
          <th>{t('followUp.columns.patient')}</th>
          <th>{t('common.status')}</th>
          <th>{t('appointmentsPage.print.lastTreatment')}</th>
          <th>{t('appointmentsPage.print.balance')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const endMin = timeToMinutes(a.time) + a.durationMin;
          return (
            <tr key={a.id}>
              <td>
                {formatClockTime(a.time, language)} – {formatClockTime(minutesToTime(endMin), language)}
              </td>
              <td>{a.patientName}</td>
              <td>{t(calendarStatusKey(a.status))}</td>
              <PatientSummaryCells appt={a} summaries={summaries} language={language} t={t} />
            </tr>
          );
        })}
      </tbody>
    </PrintTable>
  );
}

export function AppointmentsPrintView({
  dateLabel,
  appointments,
  emergencies,
  patientSummaries,
  language,
  clinic,
}: AppointmentsPrintViewProps) {
  const { t } = useTranslation();

  const regular = appointments
    .filter((a) => a.status !== 'CANCELLED' && a.appointmentType !== 'EMERGENCY')
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const emergencyRows = emergencies
    .filter((a) => a.status !== 'CANCELLED')
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  return (
    <PrintDocument orientation="landscape">
      <PrintReportHeader
        clinic={clinic}
        title={t('appointmentsPage.print.dailyTitle')}
        meta={
          <PrintMetaRow>
            <PrintMetaItem label={t('common.date')} value={dateLabel} />
            <PrintMetaItem label={t('reports.print.printedOn')} value={new Date().toLocaleString(language)} />
          </PrintMetaRow>
        }
      />

      <PrintSection title={t('appointmentsPage.title')}>
        <PrintAppointmentTable rows={regular} summaries={patientSummaries} language={language} t={t} />
      </PrintSection>

      <PrintSection title={t('appointmentsPage.emergency.title')}>
        <PrintAppointmentTable rows={emergencyRows} summaries={patientSummaries} language={language} t={t} />
      </PrintSection>

      <PrintFooter />
    </PrintDocument>
  );
}
