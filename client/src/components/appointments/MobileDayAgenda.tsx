import { useTranslation } from 'react-i18next';
import { AppointmentWithPatient } from '@/types/domain';
import { formatClockTime } from '@/utils/calendar';
import { formatDateDisplay } from '@/utils/date';

interface DayChip {
  iso: string;
  isToday: boolean;
}

interface MobileDayAgendaProps {
  date: string;
  language: string;
  appointments: AppointmentWithPatient[];
  days: DayChip[];
  onDaySelect: (iso: string) => void;
  onAppointmentOpen: (appt: AppointmentWithPatient) => void;
}

export function MobileDayAgenda({
  date,
  language,
  appointments,
  days,
  onDaySelect,
  onAppointmentOpen,
}: MobileDayAgendaProps) {
  const { t } = useTranslation();
  const visible = appointments.filter((a) => a.status !== 'CANCELLED');

  return (
    <div className="mobile-day-agenda">
      <div className="week-agenda__mobile-strip" aria-label={t('appointmentsPage.weekView')}>
        {days.map((d) => {
          const dateObj = new Date(`${d.iso}T12:00:00`);
          return (
            <button
              key={d.iso}
              type="button"
              className={[
                'week-agenda__mobile-day',
                d.isToday ? 'week-agenda__mobile-day--today' : '',
                d.iso === date ? 'week-agenda__mobile-day--focused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onDaySelect(d.iso)}
            >
              <span className="week-agenda__mobile-day-name">
                {dateObj.toLocaleDateString(language, { weekday: 'short' })}
              </span>
              <span className="week-agenda__mobile-day-number">
                {dateObj.toLocaleDateString(language, { day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>
      <h2 className="mobile-day-agenda__title">{formatDateDisplay(date, language)}</h2>
      {visible.length === 0 ? (
        <p className="muted">{t('appointmentsPage.noAppointmentsDay')}</p>
      ) : (
        <ul className="mobile-day-agenda__list">
          {visible.map((appt) => (
            <li key={appt.id}>
              <button type="button" className="mobile-day-agenda__card" onClick={() => onAppointmentOpen(appt)}>
                <span className="mobile-day-agenda__time">{formatClockTime(appt.time, language)}</span>
                <span className="mobile-day-agenda__name">
                  {appt.patientName}
                  {!appt.patientId && (
                    <span className="appointment-card__guest-tag">{t('appointmentsPage.walkin.tag')}</span>
                  )}
                </span>
                {appt.reason ? <span className="mobile-day-agenda__reason">{appt.reason}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
