import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Area } from '@/types/domain';

interface AreaPickerProps {
  value: string;
  onChange: (value: string) => void;
  areas: Area[];
  placeholder?: string;
}

export function AreaPicker({ value, onChange, areas, placeholder }: AreaPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((a) => a.name.toLowerCase().includes(q));
  }, [areas, value]);

  return (
    <div className="area-picker patient-search-box">
      <Search size={14} className="patient-search-box__icon" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? t('patientRecord.patient.areaPlaceholder')}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="patient-search-box__results area-picker__results">
          {filtered.slice(0, 15).map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(area.name);
                  setOpen(false);
                }}
              >
                <span className="patient-search-box__name">{area.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
