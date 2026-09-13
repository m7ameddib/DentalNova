import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList } from 'lucide-react';
import { appointmentsApi } from '@/api/appointments.api';
import { followUpsApi } from '@/api/follow-ups.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay, localTodayIso } from '@/utils/date';
import { formatClockTime } from '@/utils/calendar';

export function WorkspaceTodayPanel() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const today = localTodayIso();
  const canViewAppointments = usePermission(PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewFollowUps = usePermission(PERMISSIONS.FOLLOWUPS_MANAGE);

  const { data: schedule } = useQuery({
    queryKey: ['day-schedule', today],
    queryFn: () => appointmentsApi.daySchedule(today),
    enabled: canViewAppointments,
    staleTime: 30_000,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ['follow-ups-today', today],
    queryFn: () => followUpsApi.workItemsForDate(today),
    enabled: canViewFollowUps,
    staleTime: 30_000,
  });

  const appointments = (schedule?.appointments ?? []).filter((a) => a.status !== 'CANCELLED').slice(0, 6);
  const dueFollowUps = followUps.slice(0, 6);

  return (
    <aside className="workspace-today-panel">
      {canViewAppointments && (
        <section className="workspace-today-panel__block">
          <div className="workspace-today-panel__heading">
            <h2>
              <CalendarDays size={16} />
              {t('workspaceToday.appointments')}
            </h2>
            <Link to="/appointments" className="link-btn">
              {t('workspaceToday.viewCalendar')}
            </Link>
          </div>
          {appointments.length === 0 ? (
            <p className="muted workspace-today-panel__empty">{t('workspaceToday.noAppointments')}</p>
          ) : (
            <ul className="workspace-today-panel__list">
              {appointments.map((a) => (
                <li key={a.id}>
                  <Link to={`/appointments?appointmentId=${a.id}&date=${a.date}`}>
                    <strong>{formatClockTime(a.time, language)}</strong>
                    <span>{a.patientName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canViewFollowUps && (
        <section className="workspace-today-panel__block">
          <div className="workspace-today-panel__heading">
            <h2>
              <ClipboardList size={16} />
              {t('workspaceToday.followUps')}
            </h2>
            <Link to="/follow-ups" className="link-btn">
              {t('workspaceToday.viewFollowUps')}
            </Link>
          </div>
          {dueFollowUps.length === 0 ? (
            <p className="muted workspace-today-panel__empty">{t('workspaceToday.noFollowUps')}</p>
          ) : (
            <ul className="workspace-today-panel__list">
              {dueFollowUps.map((fu) => (
                <li key={fu.id}>
                  <Link to="/follow-ups">
                    <strong>{fu.patientName}</strong>
                    <span>
                      {t(`followUp.types.${fu.type}`)} · {formatDateDisplay(fu.followUpDate, language)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  );
}
