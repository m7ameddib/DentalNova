import { MessageCircle, Printer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppointmentWithPatient } from '@/types/domain';
import { formatClockTime, minutesToTime, timeToMinutes } from '@/utils/calendar';
import { formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { PatientPrintSummary } from './printHelpers';

interface TodaysBriefPanelProps {
  dateIso: string;
  language: string;
  appointments: AppointmentWithPatient[];
  emergencies: AppointmentWithPatient[];
  patientSummaries: Map<number, PatientPrintSummary>;
  canSendWhatsApp: boolean;
  onClose: () => void;
  onPrint: () => void;
  onSendWhatsApp: () => void;
  onAppointmentSelect: (appt: AppointmentWithPatient) => void;
}

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === 'SCHEDULED') return t('appointmentsPage.statusCalendar.ARRIVED');
  if (status === 'WAITING') return t('appointmentsPage.statusCalendar.WAITING');
  if (status === 'IN_TREATMENT') return t('appointmentsPage.statusCalendar.IN_TREATMENT');
  if (status === 'CANCELLED') return t('appointmentsPage.statusCalendar.CANCELLED');
  return t(`appointmentsPage.status.${status}`);
}

function BriefRow({
  appt,
  summaries,
  language,
  t,
  onSelect,
}: {
  appt: AppointmentWithPatient;
  summaries: Map<number, PatientPrintSummary>;
  language: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onSelect: () => void;
}) {
  const endMin = timeToMinutes(appt.time) + appt.durationMin;
  const summary = appt.patientId ? summaries.get(appt.patientId) : undefined;
  const lastTreatment =
    summary?.lastTreatmentLabel && summary.lastTreatmentDate
      ? `${summary.lastTreatmentLabel} (${formatDateDisplay(summary.lastTreatmentDate, language)})`
      : summary?.lastTreatmentLabel ?? '—';
  const balance =
    summary && summary.remainingCents > 0
      ? formatMoney(summary.remainingCents)
      : appt.patientId
        ? t('appointmentsPage.print.paid')
        : '—';
  const phone = appt.patientId ? appt.patientPhone : appt.guestPhone;

  return (
    <button type="button" className="today-brief-row" onClick={onSelect}>
      <div className="today-brief-row__time">
        {formatClockTime(appt.time, language)} – {formatClockTime(minutesToTime(endMin), language)}
      </div>
      <div className="today-brief-row__main">
        <div className="today-brief-row__name">
          {appt.patientName}
          {!appt.patientId && (
            <span className="appointment-card__guest-tag">{t('appointmentsPage.walkin.tag')}</span>
          )}
        </div>
        <div className="today-brief-row__meta">
          {appt.patientFileNumber && (
            <span>
              {t('patientRecord.patient.fileNumber')}: {appt.patientFileNumber}
            </span>
          )}
          {phone && (
            <span>
              {t('patientRecord.patient.phone')}: {phone}
            </span>
          )}
          {appt.reason && (
            <span>
              {t('appointmentsPage.reason')}: {appt.reason}
            </span>
          )}
        </div>
        {appt.patientId && (
          <div className="today-brief-row__clinical">
            <span>
              {t('appointmentsPage.print.lastTreatment')}: {lastTreatment}
            </span>
            <span>
              {t('appointmentsPage.print.balance')}: {balance}
            </span>
          </div>
        )}
      </div>
      <div className={`today-brief-row__status today-brief-row__status--${appt.status.toLowerCase()}`}>
        {statusLabel(appt.status, t)}
      </div>
    </button>
  );
}

function BriefSection({
  title,
  rows,
  summaries,
  language,
  t,
  onAppointmentSelect,
}: {
  title: string;
  rows: AppointmentWithPatient[];
  summaries: Map<number, PatientPrintSummary>;
  language: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onAppointmentSelect: (appt: AppointmentWithPatient) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="today-brief-section">
      <h4 className="today-brief-section__title">{title}</h4>
      <div className="today-brief-list">
        {rows.map((appt) => (
          <BriefRow
            key={appt.id}
            appt={appt}
            summaries={summaries}
            language={language}
            t={t}
            onSelect={() => onAppointmentSelect(appt)}
          />
        ))}
      </div>
    </section>
  );
}

export function TodaysBriefPanel({
  dateIso,
  language,
  appointments,
  emergencies,
  patientSummaries,
  canSendWhatsApp,
  onClose,
  onPrint,
  onSendWhatsApp,
  onAppointmentSelect,
}: TodaysBriefPanelProps) {
  const { t } = useTranslation();
  const dateLabel = formatDateDisplay(dateIso, language);
  const totalCount = appointments.length + emergencies.length;

  return (
    <div className="today-brief-overlay" onClick={onClose}>
      <div className="today-brief-panel" onClick={(e) => e.stopPropagation()}>
        <div className="today-brief-panel__header">
          <div>
            <h3>{t('appointmentsPage.todayBrief.title')}</h3>
            <p className="today-brief-panel__subtitle">
              {dateLabel} · {t('appointmentsPage.todayBrief.appointmentCount', { count: totalCount })}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close') ?? ''}>
            <X size={16} />
          </button>
        </div>

        <div className="today-brief-panel__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small btn--whatsapp"
            onClick={onSendWhatsApp}
            disabled={!canSendWhatsApp}
            title={!canSendWhatsApp ? t('whatsapp.noAppointmentsToday') ?? '' : t('whatsapp.sendTodaysAppointmentsToDoctor') ?? ''}
          >
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={onPrint}>
            <Printer size={14} /> {t('appointmentsPage.print.button')}
          </button>
        </div>

        {totalCount === 0 ? (
          <p className="today-brief-empty">{t('appointmentsPage.print.noEntries')}</p>
        ) : (
          <div className="today-brief-panel__body">
            <BriefSection
              title={t('appointmentsPage.title')}
              rows={appointments}
              summaries={patientSummaries}
              language={language}
              t={t}
              onAppointmentSelect={onAppointmentSelect}
            />
            <BriefSection
              title={t('appointmentsPage.emergency.title')}
              rows={emergencies}
              summaries={patientSummaries}
              language={language}
              t={t}
              onAppointmentSelect={onAppointmentSelect}
            />
          </div>
        )}

        <p className="today-brief-panel__hint muted">{t('appointmentsPage.todayBrief.tapHint')}</p>
      </div>
    </div>
  );
}
