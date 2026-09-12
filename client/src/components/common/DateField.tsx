import { InputHTMLAttributes, useEffect } from 'react';
import { localTodayIso } from '@/utils/date';

type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

/** Native date input that opens on today's month when the field is empty. */
export function DateField({ value, onChange, onFocus, ...rest }: DateFieldProps) {
  return (
    <input
      type="date"
      lang="en-GB"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => {
        if (!value) onChange(localTodayIso());
        onFocus?.(e);
      }}
      {...rest}
    />
  );
}

type DmyDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  startOnToday?: boolean;
};

function splitIso(iso: string): { day: string; month: string; year: string } {
  const [year = '', month = '', day = ''] = iso ? iso.split('-') : [];
  return { day, month, year };
}

function clampDay(year: string, month: string, day: string): string {
  if (!year || !month || !day) return day;
  const last = new Date(Number(year), Number(month), 0).getDate();
  return String(Math.min(Number(day), last)).padStart(2, '0');
}

/** Date of birth / clinic dates as Day → Month → Year. New fields can start on today. */
export function DmyDateField({ value, onChange, startOnToday = false }: DmyDateFieldProps) {
  const today = localTodayIso();

  useEffect(() => {
    if (startOnToday && !value) onChange(today);
  }, [startOnToday, value, onChange, today]);

  const current = value || (startOnToday ? today : '');
  const { day, month, year } = splitIso(current);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1919 }, (_, i) => String(thisYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const lastDay = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'));

  function commit(nextDay: string, nextMonth: string, nextYear: string) {
    if (!nextDay || !nextMonth || !nextYear) {
      onChange('');
      return;
    }
    onChange(`${nextYear}-${nextMonth}-${clampDay(nextYear, nextMonth, nextDay)}`);
  }

  return (
    <div className="dmy-date-field" dir="ltr">
      <select
        aria-label="Day"
        value={day}
        onChange={(e) => commit(e.target.value, month, year)}
      >
        <option value="">DD</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        value={month}
        onChange={(e) => commit(day, e.target.value, year)}
      >
        <option value="">MM</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={year}
        onChange={(e) => commit(day, month, e.target.value)}
      >
        <option value="">YYYY</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
