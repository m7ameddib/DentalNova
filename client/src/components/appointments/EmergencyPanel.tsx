import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRightLeft, Plus, User } from 'lucide-react';
import { appointmentsApi } from '@/api/appointments.api';
import { patientsApi } from '@/api/patients.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { AppointmentStatus, AppointmentWithPatient, Patient } from '@/types/domain';
import { formatClockTime } from '@/utils/calendar';
import { todayIso } from '@/utils/date';
import { DEFAULT_DURATION, EMERGENCY_STATUS_OPTIONS, EMERGENCY_TYPE } from './constants';

interface EmergencyPanelProps {
  language: string;
  onOpenPatient: (patientId: number) => void;
  onManageEmergency: (appt: AppointmentWithPatient) => void;
  onConvertToRegular: (appt: AppointmentWithPatient) => void;
}

function currentTimeRounded(): string {
  const now = new Date();
  const min = Math.round(now.getMinutes() / 5) * 5;
  const h = now.getHours().toString().padStart(2, '0');
  const m = (min === 60 ? 0 : min).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function EmergencyPanel({
  language,
  onOpenPatient,
  onManageEmergency,
  onConvertToRegular,
}: EmergencyPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canCreate = usePermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const canEdit = usePermission(PERMISSIONS.APPOINTMENTS_EDIT);
  const today = todayIso();

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'patient' | 'walkin'>('patient');
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: schedule } = useQuery({
    queryKey: ['day-schedule', today],
    queryFn: () => appointmentsApi.daySchedule(today),
  });

  const { data: patientResults = [] } = useQuery({
    queryKey: ['emergency-patient-search', patientQuery],
    queryFn: () => patientsApi.search(patientQuery),
    enabled: showForm && mode === 'patient' && patientQuery.trim().length > 0 && !selectedPatient,
  });

  const emergencies = (schedule?.appointments ?? [])
    .filter((a) => a.appointmentType === EMERGENCY_TYPE && a.status !== 'CANCELLED')
    .sort((a, b) => a.time.localeCompare(b.time));

  const activeEmergencies = emergencies.filter((a) => a.status !== 'COMPLETED');
  const completedEmergencies = emergencies.filter((a) => a.status === 'COMPLETED');

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-schedule', today] });
      resetForm();
    },
    onError: () => setError(t('common.error')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['day-schedule', today] }),
  });

  function resetForm() {
    setShowForm(false);
    setMode('patient');
    setPatientQuery('');
    setSelectedPatient(null);
    setGuestName('');
    setGuestPhone('');
    setError(null);
  }

  function handleAdd() {
    const payload = {
      date: today,
      time: currentTimeRounded(),
      durationMin: DEFAULT_DURATION,
      appointmentType: EMERGENCY_TYPE,
      reason: t('appointmentsPage.emergency.defaultReason'),
      allowOutsideHours: true,
    };

    if (mode === 'patient') {
      if (!selectedPatient) {
        setError(t('appointmentsPage.selectPatient'));
        return;
      }
      createMutation.mutate({ ...payload, patientId: selectedPatient.id });
      return;
    }

    if (!guestName.trim() || !guestPhone.trim()) {
      setError(t('appointmentsPage.walkin.validation'));
      return;
    }
    createMutation.mutate({ ...payload, guestName: guestName.trim(), guestPhone: guestPhone.trim() });
  }

  function handleCardClick(appt: AppointmentWithPatient) {
    if (appt.patientId) {
      onOpenPatient(appt.patientId);
      return;
    }
    onManageEmergency(appt);
  }

  return (
    <aside className="emergency-panel">
      <div className="emergency-panel__header">
        <AlertCircle size={18} className="emergency-panel__icon" />
        <h2>{t('appointmentsPage.emergency.title')}</h2>
        {canCreate && (
          <button
            type="button"
            className="emergency-panel__add-btn"
            onClick={() => setShowForm((v) => !v)}
            title={t('appointmentsPage.emergency.add')}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <p className="emergency-panel__hint">{t('appointmentsPage.emergency.hint')}</p>

      {showForm && canCreate && (
        <div className="emergency-panel__form">
          <div className="booking-mode-toggle booking-mode-toggle--compact">
            <button
              type="button"
              className={mode === 'patient' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
              onClick={() => setMode('patient')}
            >
              {t('appointmentsPage.existingPatient')}
            </button>
            <button
              type="button"
              className={mode === 'walkin' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
              onClick={() => setMode('walkin')}
            >
              {t('appointmentsPage.walkin.tabLabel')}
            </button>
          </div>

          {mode === 'patient' ? (
            selectedPatient ? (
              <div className="selected-patient-chip selected-patient-chip--compact">
                <span>{selectedPatient.fullName}</span>
                <button type="button" className="link-btn" onClick={() => setSelectedPatient(null)}>
                  {t('common.edit')}
                </button>
              </div>
            ) : (
              <input
                autoFocus
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder={t('appointmentsPage.selectPatientPlaceholder') ?? ''}
                className="emergency-panel__input"
              />
            )
          ) : (
            <>
              <input
                autoFocus
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t('appointmentsPage.walkin.namePlaceholder') ?? ''}
                className="emergency-panel__input"
              />
              <input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder={t('appointmentsPage.walkin.phonePlaceholder') ?? ''}
                className="emergency-panel__input"
              />
            </>
          )}

          {mode === 'patient' && patientQuery.trim() && !selectedPatient && (
            <ul className="emergency-panel__results">
              {patientResults.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setSelectedPatient(p); setPatientQuery(''); }}>
                    {p.fullName} · {p.phone}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="emergency-panel__error">{error}</p>}

          <div className="emergency-panel__form-actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={resetForm}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={handleAdd}
              disabled={createMutation.isPending}
            >
              {t('appointmentsPage.emergency.add')}
            </button>
          </div>
        </div>
      )}

      <div className="emergency-panel__list">
        {activeEmergencies.length === 0 && (
          <p className="emergency-panel__empty">{t('appointmentsPage.emergency.empty')}</p>
        )}
        {activeEmergencies.map((appt) => (
          <EmergencyCard
            key={appt.id}
            appt={appt}
            language={language}
            canEdit={canEdit}
            onClick={() => handleCardClick(appt)}
            onStatusChange={(status) => statusMutation.mutate({ id: appt.id, status })}
            onConvert={() => onConvertToRegular(appt)}
            showConvert={canEdit}
          />
        ))}
      </div>

      {completedEmergencies.length > 0 && (
        <div className="emergency-panel__completed">
          <span className="emergency-panel__completed-label">{t('appointmentsPage.emergency.completedSection')}</span>
          {completedEmergencies.map((appt) => (
            <EmergencyCard
              key={appt.id}
              appt={appt}
              language={language}
              canEdit={canEdit}
              onClick={() => handleCardClick(appt)}
              onStatusChange={(status) => statusMutation.mutate({ id: appt.id, status })}
              onConvert={() => onConvertToRegular(appt)}
              showConvert={false}
              dimmed
            />
          ))}
        </div>
      )}
    </aside>
  );
}

function EmergencyCard({
  appt,
  language,
  canEdit,
  onClick,
  onStatusChange,
  onConvert,
  showConvert,
  dimmed,
}: {
  appt: AppointmentWithPatient;
  language: string;
  canEdit: boolean;
  onClick: () => void;
  onStatusChange: (status: AppointmentStatus) => void;
  onConvert: () => void;
  showConvert: boolean;
  dimmed?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={[
        'emergency-card',
        `emergency-card--${appt.status.toLowerCase()}`,
        dimmed ? 'emergency-card--dimmed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="emergency-card__main" onClick={onClick}>
        <span className="emergency-card__name">
          <User size={14} />
          {appt.patientName}
        </span>
        <span className="emergency-card__time">
          {t('appointmentsPage.emergency.arrivedAt', { time: formatClockTime(appt.time, language) })}
        </span>
        <span className={`emergency-card__status emergency-card__status--${appt.status.toLowerCase()}`}>
          {t(`appointmentsPage.status.${appt.status}`)}
        </span>
      </button>

      {canEdit && !dimmed && (
        <div className="emergency-card__actions">
          {EMERGENCY_STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={[
                'emergency-card__status-btn',
                appt.status === s ? 'emergency-card__status-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onStatusChange(s)}
            >
              {t(`appointmentsPage.status.${s}`)}
            </button>
          ))}
          {showConvert && (
            <button type="button" className="emergency-card__convert-btn" onClick={onConvert}>
              <ArrowRightLeft size={12} />
              {t('appointmentsPage.emergency.convertToRegular')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
