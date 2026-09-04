import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '@/api/appointments.api';
import { buildMondayFirstMonthGrid, mondayFirstWeekdayLabels } from '@/utils/calendar';
import { todayIso } from '@/utils/date';

function toMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

interface MonthCalendarProps {
  focusDate: string;
  language: string;
  onDaySelect: (iso: string) => void;
}

export function MonthCalendar({ focusDate, language, onDaySelect }: MonthCalendarProps) {
  const today = todayIso();
  const [year, month] = focusDate.split('-').map(Number);
  const viewYear = year;
  const viewMonth = month;

  const monthKey = toMonthKey(viewYear, viewMonth);

  const { data: monthCounts = [] } = useQuery({
    queryKey: ['appointments-month', monthKey],
    queryFn: () => appointmentsApi.monthOverview(monthKey),
  });

  const countMap = useMemo(() => new Map(monthCounts.map((c) => [c.date, c.count])), [monthCounts]);
  const weeks = useMemo(() => buildMondayFirstMonthGrid(viewYear, viewMonth - 1), [viewYear, viewMonth]);
  const weekdayLabels = useMemo(() => mondayFirstWeekdayLabels(language, 'short'), [language]);

  return (
    <div className="month-agenda">
      <div className="month-agenda__weekdays">
        {weekdayLabels.map((label) => (
          <span key={label} className="month-agenda__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="month-agenda__grid">
        {weeks.map((week, wi) =>
          week.map((iso, di) => {
            if (!iso) {
              return <span key={`${wi}-${di}`} className="month-agenda__cell month-agenda__cell--empty" />;
            }
            const count = countMap.get(iso) ?? 0;
            const isToday = iso === today;
            const isSelected = iso === focusDate;

            return (
              <button
                key={iso}
                type="button"
                className={[
                  'month-agenda__cell',
                  isToday ? 'month-agenda__cell--today' : '',
                  isSelected ? 'month-agenda__cell--selected' : '',
                  count > 0 ? 'month-agenda__cell--has-appts' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onDaySelect(iso)}
              >
                <span className="month-agenda__cell-day">{Number(iso.slice(8))}</span>
                {count > 0 && (
                  <span className="month-agenda__cell-count">{count}</span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
