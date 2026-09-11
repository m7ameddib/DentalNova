import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { patientsApi } from '@/api/patients.api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuthStore } from '@/store/auth.store';
import { rememberRecentPatient } from '@/utils/recentPatients';
import { Patient } from '@/types/domain';

/** Compact patient search used inside the Patient section header — searches by name, phone, or file number. */
export function PatientSearchBox() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['patient-search-header', debouncedQuery],
    queryFn: () => patientsApi.search(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30_000,
  });
  const searching =
    query.trim().length > 0 && (query.trim() !== debouncedQuery.trim() || isFetching);

  function openPatient(patient: Patient) {
    if (user?.id) {
      rememberRecentPatient(user.id, user.clinicId, patient);
    }
    const cached = queryClient.getQueryData(['patient', patient.id]);
    if (!cached) {
      queryClient.setQueryData(['patient', patient.id], { ...patient, familyMembers: [] });
    }
    void queryClient.prefetchQuery({
      queryKey: ['patient', patient.id],
      queryFn: () => patientsApi.getById(patient.id),
      staleTime: 30_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ['patient-treatments', patient.id],
      queryFn: () => patientsApi.treatments(patient.id),
      staleTime: 30_000,
    });
    setQuery('');
    setOpen(false);
    navigate(`/patients/${patient.id}`);
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
              <button type="button" onMouseDown={() => openPatient(p)}>
                <span className="patient-search-box__name">{p.fullName}</span>
                <span className="muted">
                  {p.fileNumber} · {p.phone}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && !searching && (
            <li className="muted patient-search-box__empty">{t('common.noResults')}</li>
          )}
          {results.length === 0 && searching && (
            <li className="muted patient-search-box__empty">{t('common.loading')}</li>
          )}
        </ul>
      )}
    </div>
  );
}
