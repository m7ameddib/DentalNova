import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { workingScheduleApi, WeeklyDaySchedule, WorkingPeriod, ScheduleException } from '@/api/working-schedule.api';
import { getErrorMessage } from '@/utils/errors';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function defaultDay(dayOfWeek: number): WeeklyDaySchedule {
  return {
    dayOfWeek,
    isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
    periods: [{ startTime: '09:00', endTime: '17:00' }],
  };
}

export function WorkingHoursSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<WeeklyDaySchedule[]>(DAYS.map(defaultDay));
  const [error, setError] = useState<string | null>(null);

  const [exDate, setExDate] = useState('');
  const [exClosed, setExClosed] = useState(true);
  const [exNote, setExNote] = useState('');
  const [exPeriods, setExPeriods] = useState<WorkingPeriod[]>([{ startTime: '09:00', endTime: '17:00' }]);

  const { data: weekly } = useQuery({
    queryKey: ['working-schedule-weekly'],
    queryFn: () => workingScheduleApi.getWeekly(),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['working-schedule-exceptions'],
    queryFn: () => workingScheduleApi.listExceptions(),
  });

  useEffect(() => {
    if (weekly?.length) {
      setDays(
        DAYS.map((d) => {
          const found = weekly.find((w) => w.dayOfWeek === d);
          return found ?? defaultDay(d);
        }),
      );
    }
  }, [weekly]);

  const saveMutation = useMutation({
    mutationFn: () => workingScheduleApi.saveWeekly(days.map((d, i) => ({ ...d, dayOfWeek: i }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-schedule-weekly'] });
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const addExceptionMutation = useMutation({
    mutationFn: () =>
      workingScheduleApi.createException({
        exceptionDate: exDate,
        isClosed: exClosed,
        note: exNote.trim() || undefined,
        periods: exClosed ? undefined : exPeriods,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-schedule-exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
      setExDate('');
      setExNote('');
      setExClosed(true);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: number) => workingScheduleApi.deleteException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-schedule-exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
    },
  });

  function toggleDayOpen(dayOfWeek: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              isOpen: !d.isOpen,
              periods: !d.isOpen && d.periods.length === 0 ? [{ startTime: '09:00', endTime: '17:00' }] : d.periods,
            }
          : d,
      ),
    );
  }

  function updatePeriod(dayOfWeek: number, periodIdx: number, field: keyof WorkingPeriod, value: string) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const periods = d.periods.map((p, i) => (i === periodIdx ? { ...p, [field]: value } : p));
        return { ...d, periods };
      }),
    );
  }

  function addPeriod(dayOfWeek: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, periods: [...d.periods, { startTime: '14:00', endTime: '18:00' }] }
          : d,
      ),
    );
  }

  function removePeriod(dayOfWeek: number, periodIdx: number) {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const periods = d.periods.filter((_, i) => i !== periodIdx);
        return { ...d, periods, isOpen: periods.length > 0 ? d.isOpen : false };
      }),
    );
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.workingHours.title')}</h2>
      <p className="muted settings-section__hint">{t('settings.workingHours.perDayHint')}</p>

      <div className="working-hours-weekly">
        {days.map((day) => (
          <div key={day.dayOfWeek} className="working-hours-day">
            <div className="working-hours-day__header">
              <button
                type="button"
                className={day.isOpen ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
                onClick={() => toggleDayOpen(day.dayOfWeek)}
              >
                {t(`settings.workingHours.days.${day.dayOfWeek}`)}
              </button>
              {!day.isOpen && <span className="muted">{t('settings.workingHours.closed')}</span>}
            </div>
            {day.isOpen && (
              <div className="working-hours-day__periods">
                {day.periods.map((p, idx) => (
                  <div key={idx} className="working-hours-period">
                    <input type="time" value={p.startTime} onChange={(e) => updatePeriod(day.dayOfWeek, idx, 'startTime', e.target.value)} />
                    <span>–</span>
                    <input type="time" value={p.endTime} onChange={(e) => updatePeriod(day.dayOfWeek, idx, 'endTime', e.target.value)} />
                    {day.periods.length > 1 && (
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => removePeriod(day.dayOfWeek, idx)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {day.periods.length < 3 && (
                  <button type="button" className="link-btn" onClick={() => addPeriod(day.dayOfWeek)}>
                    <Plus size={12} /> {t('settings.workingHours.addPeriod')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="form-error-banner">{error}</div>}
      <div className="form-actions form-actions--start">
        <button type="button" className="btn btn--primary btn--small" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {t('common.save')}
        </button>
      </div>

      <h3 className="settings-section__sub-title">{t('settings.workingHours.exceptionsTitle')}</h3>
      <p className="muted">{t('settings.workingHours.exceptionsHint')}</p>

      <div className="inline-form working-hours-exception-form">
        <label className="form-field">
          <span className="form-field__label">{t('common.date')}</span>
          <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
        </label>
        <label className="form-field">
          <span className="form-field__label">{t('settings.workingHours.exceptionType')}</span>
          <select value={exClosed ? 'closed' : 'custom'} onChange={(e) => setExClosed(e.target.value === 'closed')}>
            <option value="closed">{t('settings.workingHours.closedAllDay')}</option>
            <option value="custom">{t('settings.workingHours.customHours')}</option>
          </select>
        </label>
        {!exClosed && exPeriods.map((p, idx) => (
          <div key={idx} className="working-hours-period">
            <input type="time" value={p.startTime} onChange={(e) => setExPeriods((prev) => prev.map((x, i) => (i === idx ? { ...x, startTime: e.target.value } : x)))} />
            <span>–</span>
            <input type="time" value={p.endTime} onChange={(e) => setExPeriods((prev) => prev.map((x, i) => (i === idx ? { ...x, endTime: e.target.value } : x)))} />
          </div>
        ))}
        <label className="form-field">
          <span className="form-field__label">{t('common.note')}</span>
          <input value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder={t('settings.workingHours.exceptionNotePlaceholder') ?? ''} />
        </label>
        <button type="button" className="btn btn--ghost btn--small" onClick={() => addExceptionMutation.mutate()} disabled={!exDate || addExceptionMutation.isPending}>
          {t('settings.workingHours.addException')}
        </button>
      </div>

      {exceptions.length > 0 && (
        <ul className="schedule-exceptions-list">
          {exceptions.map((ex: ScheduleException) => (
            <li key={ex.id}>
              <span>
                <strong>{ex.exceptionDate}</strong>
                {ex.isClosed
                  ? ` — ${t('settings.workingHours.closedAllDay')}`
                  : ` — ${ex.periods.map((p) => `${p.startTime}–${p.endTime}`).join(', ')}`}
                {ex.note ? ` (${ex.note})` : ''}
              </span>
              <button type="button" className="link-btn link-btn--danger" onClick={() => deleteExceptionMutation.mutate(ex.id)}>
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
