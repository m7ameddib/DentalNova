import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { patientsApi } from '@/api/patients.api';
import { Modal } from '@/components/common/Modal';
import { Patient } from '@/types/domain';
import { formatDateTimeDisplay } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';

export function PatientArchiveSection() {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const [confirmPermanentId, setConfirmPermanentId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: archived = [], isLoading } = useQuery({
    queryKey: ['patients-archived'],
    queryFn: () => patientsApi.listArchived(),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => patientsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-archived'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => patientsApi.deletePermanently(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-archived'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setConfirmPermanentId(null);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const pendingPatient = archived.find((p) => p.id === confirmPermanentId);

  return (
    <section className="settings-section">
      <h2>{t('settings.archive.title')}</h2>
      <p className="muted">{t('settings.archive.hint')}</p>

      {error && <div className="form-error-banner">{error}</div>}

      {isLoading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : archived.length === 0 ? (
        <p className="muted">{t('settings.archive.empty')}</p>
      ) : (
        <div className="catalog-table-wrap">
          <table className="patients-table">
            <thead>
              <tr>
                <th>{t('patients.fullName')}</th>
                <th>{t('patientRecord.patient.phone')}</th>
                <th>{t('patientRecord.patient.fileNumber')}</th>
                <th>{t('settings.archive.archivedAt')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((patient: Patient) => (
                <tr key={patient.id}>
                  <td>{patient.fullName}</td>
                  <td>{patient.phone}</td>
                  <td>{patient.fileNumber}</td>
                  <td>
                    {patient.archivedAt
                      ? formatDateTimeDisplay(patient.archivedAt, language)
                      : '—'}
                  </td>
                  <td className="catalog-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => restoreMutation.mutate(patient.id)}
                      disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
                    >
                      <RotateCcw size={14} />
                      {t('settings.archive.restore')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => setConfirmPermanentId(patient.id)}
                      disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
                    >
                      <Trash2 size={14} />
                      {t('settings.archive.deletePermanently')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmPermanentId != null && pendingPatient && (
        <Modal
          title={t('settings.archive.deleteTitle')}
          icon={<Archive size={16} />}
          onClose={() => {
            if (!permanentDeleteMutation.isPending) setConfirmPermanentId(null);
          }}
        >
          <p>{t('settings.archive.deleteWarning', { name: pendingPatient.fullName })}</p>
          <p className="muted">{t('settings.archive.deleteNote')}</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirmPermanentId(null)}
              disabled={permanentDeleteMutation.isPending}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => permanentDeleteMutation.mutate(confirmPermanentId)}
              disabled={permanentDeleteMutation.isPending}
            >
              {t('settings.archive.deleteConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
