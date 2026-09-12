import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, Plus, User } from 'lucide-react';
import { appointmentsApi } from '@/api/appointments.api';
import { patientsApi } from '@/api/patients.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { AppointmentStatus, AppointmentWithPatient, Patient } from '@/types/domain';
import { formatClockTime } from '@/utils/calendar';
import { todayIso, formatDateDisplay, currentTimeRounded, localAddDaysIso } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { DEFAULT_DURATION, EMERGENCY_STATUS_OPTIONS, EMERGENCY_TYPE, CalendarViewMode } from './constants';

interface AgendaSidebarProps {
  language: string;
  focusDate: string;
  calendarView: CalendarViewMode;
  onCalendarViewChange: (view: CalendarViewMode) => void;
  slotStepMin: 15 | 30;
  onFocusDateChange: (iso: string) => void;
  onSlotStepChange: (step: 15 | 30) => void;
  onOpenPatient: (patientId: number) => void;
  onManageEmergency: (appt: AppointmentWithPatient) => void;
  draggingEmergency: AppointmentWithPatient | null;
  onEmergencyDragStart: (appt: AppointmentWithPatient) => void;
  onEmergencyDragEnd: () => void;
}

function toMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const m = (month + 1).toString().padStart(2, '0');
    const day = d.toString().padStart(2, '0');
    cells.push(`${year}-${m}-${day}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function AgendaSidebar({
  language,
  focusDate,
  calendarView,
  onCalendarViewChange,
  slotStepMin,
  onFocusDateChange,
  onSlotStepChange,
  onOpenPatient,
  onManageEmergency,
  draggingEmergency,
  onEmergencyDragStart,
  onEmergencyDragEnd,
}: AgendaSidebarProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canCreate = usePermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const canEdit = usePermission(PERMISSIONS.APPOINTMENTS_EDIT);
  const today = todayIso();
  const [emergencyDate, setEmergencyDate] = useState(today);

  const [year, month] = focusDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);

  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [mode, setMode] = useState<'patient' | 'walkin'>('patient');
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const monthKey = toMonthKey(viewYear, viewMonth);

  const { data: monthCounts = [] } = useQuery({
    queryKey: ['appointments-month', monthKey],
    queryFn: () => appointmentsApi.monthOverview(monthKey),
  });

  const { data: schedule } = useQuery({
    queryKey: ['day-schedule', emergencyDate],
    queryFn: () => appointmentsApi.daySchedule(emergencyDate),
  });

  const { data: patientResults = [] } = useQuery({
    queryKey: ['emergency-patient-search', patientQuery],
    queryFn: () => patientsApi.search(patientQuery),
    enabled: showEmergencyForm && mode === 'patient' && patientQuery.trim().length > 0 && !selectedPatient,
  });

  const countMap = useMemo(() => new Map(monthCounts.map((c) => [c.date, c.count])), [monthCounts]);
  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth - 1), [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(language, { weekday: 'narrow' });
    });
  }, [language]);

  const emergencies = (schedule?.appointments ?? [])
    .filter((a) => a.appointmentType === EMERGENCY_TYPE && a.status !== 'CANCELLED')
    .sort((a, b) => a.time.localeCompare(b.time));

  const activeEmergencies = emergencies.filter((a) => a.status !== 'COMPLETED');

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-month'] });
      resetEmergencyForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['day-schedule', emergencyDate] }),
  });

  function resetEmergencyForm() {
    setShowEmergencyForm(false);
    setMode('patient');
    setPatientQuery('');
    setSelectedPatient(null);
    setGuestName('');
    setGuestPhone('');
    setError(null);
  }

  function handleAddEmergency() {
    const payload = {
      date: emergencyDate,
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

  function goMonth(delta: number) {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }

  function selectDay(iso: string) {
    onFocusDateChange(iso);
    const [y, m] = iso.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m);
  }

  return (
    <aside className="agenda-sidebar agenda-sidebar--compact">
      <div className="agenda-sidebar__section agenda-sidebar__section--view">
        <div className="calendar-view-bar">
          <button
            type="button"
            className={calendarView === 'week' ? 'calendar-view-bar__btn calendar-view-bar__btn--active' : 'calendar-view-bar__btn'}
            onClick={() => onCalendarViewChange('week')}
          >
            {t('appointmentsPage.viewMode.week')}
          </button>
          <button
            type="button"
            className={calendarView === 'month' ? 'calendar-view-bar__btn calendar-view-bar__btn--active' : 'calendar-view-bar__btn'}
            onClick={() => onCalendarViewChange('month')}
          >
            {t('appointmentsPage.viewMode.month')}
          </button>
        </div>
      </div>

      {calendarView === 'week' && (
      <div className="agenda-sidebar__section agenda-sidebar__section--slot">
        <div className="slot-interval-bar">
          <button
            type="button"
            className={slotStepMin === 15 ? 'slot-interval-bar__btn slot-interval-bar__btn--active' : 'slot-interval-bar__btn'}
            onClick={() => onSlotStepChange(15)}
          >
            15 min
          </button>
          <button
            type="button"
            className={slotStepMin === 30 ? 'slot-interval-bar__btn slot-interval-bar__btn--active' : 'slot-interval-bar__btn'}
            onClick={() => onSlotStepChange(30)}
          >
            30 min
          </button>
        </div>
      </div>
      )}

      <div className="agenda-sidebar__section">
        <div className="mini-calendar__nav">
          <button type="button" className="icon-btn" onClick={() => goMonth(-1)} title={t('appointmentsPage.previousMonth') ?? ''}>
            <ChevronLeft size={16} />
          </button>
          <h3 className="agenda-sidebar__title agenda-sidebar__title--inline">{monthLabel}</h3>
          <button type="button" className="icon-btn" onClick={() => goMonth(1)} title={t('appointmentsPage.nextMonth') ?? ''}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="mini-calendar mini-calendar--compact">
          <div className="mini-calendar__weekdays">
            {weekdayLabels.map((label) => (
              <span key={label} className="mini-calendar__weekday">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="mini-calendar__row">
              {week.map((iso, di) => {
                if (!iso) return <span key={di} className="mini-calendar__cell mini-calendar__cell--empty" />;
                const count = countMap.get(iso) ?? 0;
                const isToday = iso === today;
                const isSelected = iso === focusDate;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      'mini-calendar__cell',
                      isToday ? 'mini-calendar__cell--today' : '',
                      isSelected ? 'mini-calendar__cell--selected' : '',
                      count > 0 ? 'mini-calendar__cell--has-appts' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectDay(iso)}
                  >
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="agenda-sidebar__section agenda-sidebar__section--emergency">
        <div className="emergency-panel__header emergency-panel__header--compact">
          <AlertCircle size={16} className="emergency-panel__icon" />
          <h2>{t('appointmentsPage.emergency.title')}</h2>
          {canCreate && (
            <button
              type="button"
              className="emergency-panel__add-btn emergency-panel__add-btn--labeled"
              onClick={() => setShowEmergencyForm((v) => !v)}
              title={t('appointmentsPage.emergency.add')}
            >
              <Plus size={14} />
              {t('appointmentsPage.emergency.add')}
            </button>
          )}
        </div>

        <div className="emergency-panel__date-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setEmergencyDate((d) => localAddDaysIso(d, -1))}
            title={t('appointmentsPage.emergency.previousDay')}
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className={[
              'emergency-panel__date',
              emergencyDate === today ? 'emergency-panel__date--today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {formatDateDisplay(emergencyDate, language)}
            {emergencyDate === today ? ` · ${t('common.today')}` : ''}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setEmergencyDate((d) => localAddDaysIso(d, 1))}
            title={t('appointmentsPage.emergency.nextDay')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {showEmergencyForm && canCreate && (
          <div className="emergency-panel__form emergency-panel__form--compact">
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
                {patientResults.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setSelectedPatient(p); setPatientQuery(''); }}>
                      {p.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="emergency-panel__error">{error}</p>}

            <div className="emergency-panel__form-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={resetEmergencyForm}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn--primary btn--small" onClick={handleAddEmergency} disabled={createMutation.isPending}>
                {t('appointmentsPage.emergency.add')}
              </button>
            </div>
          </div>
        )}

        <div className="emergency-panel__list emergency-panel__list--compact">
          {activeEmergencies.length === 0 && (
            <p className="emergency-panel__empty">{t('appointmentsPage.emergency.empty')}</p>
          )}
          {activeEmergencies.map((appt) => (
            <div
              key={appt.id}
              className={[
                'emergency-card emergency-card--draggable',
                `emergency-card--${appt.status.toLowerCase()}`,
                draggingEmergency?.id === appt.id ? 'emergency-card--dragging' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseDown={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                onEmergencyDragStart(appt);
              }}
            >
              <button
                type="button"
                className="emergency-card__main"
                onClick={() => {
                  if (appt.patientId) onOpenPatient(appt.patientId);
                  else onManageEmergency(appt);
                }}
              >
                <span className="emergency-card__name">
                  <User size={13} />
                  {appt.patientName}
                  {!appt.patientId && (
                    <span className="appointment-card__guest-tag">{t('appointmentsPage.walkin.tag')}</span>
                  )}
                </span>
                <span className="emergency-card__time">
                  {formatClockTime(appt.time, language)}
                </span>
                <span className={`emergency-card__status emergency-card__status--${appt.status.toLowerCase()}`}>
                  {t(`appointmentsPage.status.${appt.status}`)}
                </span>
              </button>
              {canEdit && (
                <div className="emergency-card__actions emergency-card__actions--compact">
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
                      onClick={() => statusMutation.mutate({ id: appt.id, status: s })}
                    >
                      {t(`appointmentsPage.status.${s}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="emergency-panel__hint emergency-panel__hint--compact">
          {t('appointmentsPage.emergency.dragHint')}
        </p>
      </div>
    </aside>
  );
}
