import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '@/api/appointments.api';
import { addDaysIso, todayIso } from '@/utils/date';
import { buildMondayFirstMonthGrid, mondayFirstWeekdayLabels, startOfWeekIso } from '@/utils/calendar';

interface AppointmentsSidebarProps {
  weekStart: string;
  slotStepMin: 15 | 30;
  onWeekStartChange: (iso: string) => void;
  onSlotStepChange: (step: 15 | 30) => void;
  language: string;
}

function toMonthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function AppointmentsSidebar({
  weekStart,
  slotStepMin,
  onWeekStartChange,
  onSlotStepChange,
  language,
}: AppointmentsSidebarProps) {
  const { t } = useTranslation();
  const today = todayIso();

  const anchorDate = addDaysIso(weekStart, 3);
  const [year, month] = anchorDate.split('-').map(Number);
  const monthKey = toMonthKey(anchorDate);

  const { data: monthCounts = [] } = useQuery({
    queryKey: ['appointments-month', monthKey],
    queryFn: () => appointmentsApi.monthOverview(monthKey),
  });

  const countMap = useMemo(() => new Map(monthCounts.map((c) => [c.date, c.count])), [monthCounts]);
  const weeks = useMemo(() => buildMondayFirstMonthGrid(year, month - 1), [year, month]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  const weekdayLabels = useMemo(() => mondayFirstWeekdayLabels(language, 'narrow'), [language]);

  function isInCurrentWeek(iso: string | null): boolean {
    if (!iso) return false;
    return startOfWeekIso(iso, language) === weekStart;
  }

  return (
    <aside className="agenda-sidebar">
      <div className="agenda-sidebar__section">
        <h3 className="agenda-sidebar__title">{monthLabel}</h3>
        <div className="mini-calendar">
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
                const inWeek = isInCurrentWeek(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      'mini-calendar__cell',
                      isToday ? 'mini-calendar__cell--today' : '',
                      inWeek ? 'mini-calendar__cell--in-week' : '',
                      count > 0 ? 'mini-calendar__cell--has-appts' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => onWeekStartChange(startOfWeekIso(iso, language))}
                  >
                    {Number(iso.slice(8))}
                    {count > 0 && <span className="mini-calendar__dot" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="agenda-sidebar__section">
        <h3 className="agenda-sidebar__title">{t('appointmentsPage.slotInterval')}</h3>
        <div className="slot-interval-toggle">
          <label className="slot-interval-toggle__option">
            <input
              type="radio"
              name="slotInterval"
              checked={slotStepMin === 15}
              onChange={() => onSlotStepChange(15)}
            />
            <span>15 {t('appointmentsPage.minutesShort')}</span>
          </label>
          <label className="slot-interval-toggle__option">
            <input
              type="radio"
              name="slotInterval"
              checked={slotStepMin === 30}
              onChange={() => onSlotStepChange(30)}
            />
            <span>30 {t('appointmentsPage.minutesShort')}</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
