import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { patientsApi } from '@/api/patients.api';

/** Compact patient search used inside the Patient section header — searches by name, phone, or file number. */
export function PatientSearchBox() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ['patient-search-header', query],
    queryFn: () => patientsApi.search(query),
    enabled: query.trim().length > 0,
  });

  function handleSelect(id: number) {
    setQuery('');
    setOpen(false);
    navigate(`/patients/${id}`);
  }

  return (
    <div className="patient-search-box">
      <Search size={14} className="patient-search-box__icon" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('patientRecord.patient.searchPlaceholder') ?? ''}
      />
      {open && query.trim() && (
        <ul className="patient-search-box__results">
          {results.slice(0, 8).map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={() => handleSelect(p.id)}>
                <span className="patient-search-box__name">{p.fullName}</span>
                <span className="muted">
                  {p.fileNumber} · {p.phone}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted patient-search-box__empty">{t('common.noResults')}</li>}
        </ul>
      )}
    </div>
  );
}
