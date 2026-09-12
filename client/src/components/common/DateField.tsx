import { InputHTMLAttributes } from 'react';
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
