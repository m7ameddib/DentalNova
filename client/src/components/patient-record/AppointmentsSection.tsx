import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { patientsApi } from '@/api/patients.api';
import { labCasesApi } from '@/api/lab-cases.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { formatDateDisplay } from '@/utils/date';

export function AppointmentsSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useUiStore();
  const canCreate = usePermission(PERMISSIONS.APPOINTMENTS_CREATE);

  const { data: appointments = [] } = useQuery({
    queryKey: ['patient-appointments-upcoming', patientId],
    queryFn: () => patientsApi.upcomingAppointments(patientId),
  });

  const { data: labData } = useQuery({
    queryKey: ['patient-lab-cases', patientId],
    queryFn: () => labCasesApi.forPatient(patientId),
  });

  const activeLabCases = labData?.active ?? [];

  return (
    <SectionCard
      title={t('patientRecord.sections.appointments')}
      icon={<CalendarClock size={16} />}
      onAdd={canCreate ? () => navigate(`/appointments?patientId=${patientId}`) : undefined}
      addTitle={t('patientRecord.appointments.openCalendar') ?? ''}
      className="section-card--appointments"
    >
      {activeLabCases.length > 0 && appointments.length > 0 && (
        <div className="appointment-lab-hints">
          {activeLabCases.map((c) => (
            <p key={c.id} className="muted appointment-lab-hint">
              {t('labCases.appointmentHint', {
                work: c.workTypeLabel,
                teeth: c.teeth.join(', '),
                date: c.expectedDeliveryDate
                  ? formatDateDisplay(c.expectedDeliveryDate, language)
                  : t('labCases.noDueDate'),
                status: t(`labCases.statuses.${c.status}`),
              })}
            </p>
          ))}
        </div>
      )}
      {appointments.length === 0 ? (
        <p className="muted">{t('patientRecord.appointments.empty')}</p>
      ) : (
        <ul className="compact-appointment-list">
          {appointments.map((a) => (
            <li key={a.id}>
              <span className="compact-appointment-list__date">
                {formatDateDisplay(a.date, language)}
              </span>
              <span className="compact-appointment-list__time">{a.time}</span>
              <span className="compact-appointment-list__reason">{a.reason || a.appointmentType}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
