import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Archive } from 'lucide-react';
import { clinicalApi, MEDICAL_ALERT_TYPES, MedicalAlertType } from '@/api/clinical.api';
import { diseaseCatalogApi } from '@/api/settings.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { getErrorMessage } from '@/utils/errors';
import { MedicalAlert } from '@/types/domain';

function alertDisplayLabel(alert: MedicalAlert, t: (key: string, opts?: { defaultValue?: string }) => string) {
  if (alert.alertType === 'DISEASE' || alert.diseaseCatalogId) return alert.label;
  return t(`patientRecord.medicalAlerts.types.${alert.alertType}`, { defaultValue: alert.label });
}

export function MedicalAlertsSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canManage = usePermission(PERMISSIONS.MEDICAL_ALERTS_MANAGE);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MedicalAlert | null>(null);
  const [alertType, setAlertType] = useState<MedicalAlertType>('DISEASE');
  const [diseaseCatalogId, setDiseaseCatalogId] = useState<number | ''>('');
  const [customLabel, setCustomLabel] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: alerts = [] } = useQuery({
    queryKey: ['medical-alerts', patientId],
    queryFn: () => clinicalApi.listAlerts(patientId),
  });

  const {
    data: diseases = [],
    isLoading: diseasesLoading,
    isError: diseasesError,
    refetch: refetchDiseases,
  } = useQuery({
    queryKey: ['disease-catalog'],
    queryFn: () => diseaseCatalogApi.listActive(),
    staleTime: 10 * 60_000,
  });

  const activeDiseaseIds = useMemo(
    () =>
      new Set(
        alerts
          .filter((a) => a.isActive && a.diseaseCatalogId != null)
          .map((a) => a.diseaseCatalogId as number),
      ),
    [alerts],
  );

  const availableDiseases = useMemo(
    () => diseases.filter((d) => !activeDiseaseIds.has(d.id)),
    [diseases, activeDiseaseIds],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['medical-alerts', patientId] });
    queryClient.invalidateQueries({ queryKey: ['medical-alerts', patientId, 'active'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof clinicalApi.createAlert>[1]) =>
      clinicalApi.createAlert(patientId, payload),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      clinicalApi.updateAlert(editing!.id, {
        alertType,
        label: alertType === 'OTHER' ? customLabel : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => clinicalApi.deactivateAlert(id),
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function resetForm() {
    setAdding(false);
    setEditing(null);
    setAlertType(diseases.length > 0 ? 'DISEASE' : 'ALLERGY');
    setDiseaseCatalogId('');
    setCustomLabel('');
    setNote('');
    setError(null);
  }

  function openAddForm() {
    void refetchDiseases();
    setAdding(true);
    setEditing(null);
    setAlertType(diseases.length > 0 ? 'DISEASE' : 'ALLERGY');
    setDiseaseCatalogId('');
    setCustomLabel('');
    setNote('');
    setError(null);
  }

  function startEdit(alert: MedicalAlert) {
    setEditing(alert);
    setAdding(false);
    if (alert.alertType === 'DISEASE' || alert.diseaseCatalogId) {
      setAlertType('DISEASE');
      setDiseaseCatalogId(alert.diseaseCatalogId ?? '');
    } else {
      setAlertType(alert.alertType as MedicalAlertType);
      setDiseaseCatalogId('');
    }
    setCustomLabel(alert.alertType === 'OTHER' ? alert.label : '');
    setNote(alert.note ?? '');
    setError(null);
  }

  function handleSave() {
    if (alertType === 'DISEASE') {
      if (!diseaseCatalogId) {
        setError(t('patientRecord.medicalAlerts.validation.diseaseRequired'));
        return;
      }
      if (editing) {
        updateMutation.mutate();
        return;
      }
      createMutation.mutate({
        diseaseCatalogId: Number(diseaseCatalogId),
        note: note.trim() || undefined,
      });
      return;
    }

    if (alertType === 'OTHER' && !customLabel.trim()) {
      setError(t('patientRecord.medicalAlerts.validation.labelRequired'));
      return;
    }

    if (editing) {
      updateMutation.mutate();
      return;
    }

    createMutation.mutate({
      alertType,
      label: alertType === 'OTHER' ? customLabel : undefined,
      note: note.trim() || undefined,
    });
  }

  function quickAddDisease(id: number) {
    setError(null);
    createMutation.mutate({ diseaseCatalogId: id });
  }

  const showForm = adding || editing;
  const editingDisease = editing?.alertType === 'DISEASE' || !!editing?.diseaseCatalogId;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="medical-alerts-section">
      <div className="medical-alerts-section__header">
        <span className="medical-alerts-section__title">
          <AlertTriangle size={14} /> {t('patientRecord.medicalAlerts.title')}
        </span>
        {canManage && !showForm && (
          <button type="button" className="link-btn" onClick={openAddForm}>
            {t('patientRecord.medicalAlerts.add')}
          </button>
        )}
      </div>

      {canManage && !showForm && diseasesLoading && (
        <p className="muted medical-alerts-catalog__hint">{t('common.loading')}</p>
      )}

      {canManage && !showForm && diseasesError && (
        <p className="form-error-banner medical-alerts-catalog__hint">{t('patientRecord.medicalAlerts.catalogLoadError')}</p>
      )}

      {canManage && !showForm && !diseasesLoading && !diseasesError && diseases.length === 0 && (
        <p className="muted medical-alerts-catalog__hint">{t('patientRecord.medicalAlerts.catalogEmpty')}</p>
      )}

      {canManage && !showForm && availableDiseases.length > 0 && (
        <div className="medical-alerts-catalog">
          <span className="muted medical-alerts-catalog__hint">{t('patientRecord.medicalAlerts.catalogHint')}</span>
          <div className="medical-alerts-catalog__chips">
            {availableDiseases.map((d) => (
              <button
                key={d.id}
                type="button"
                className="medical-alerts-catalog__chip"
                disabled={isSaving}
                onClick={() => quickAddDisease(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="inline-form medical-alerts-form">
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.medicalAlerts.type')}</span>
            <select
              value={alertType}
              onChange={(e) => {
                setAlertType(e.target.value as MedicalAlertType);
                if (e.target.value !== 'DISEASE') setDiseaseCatalogId('');
              }}
              disabled={!!editing && editingDisease}
            >
              {MEDICAL_ALERT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`patientRecord.medicalAlerts.types.${type}`)}
                </option>
              ))}
            </select>
          </label>

          {alertType === 'DISEASE' && (
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.medicalAlerts.disease')}</span>
              {diseases.length === 0 ? (
                <p className="muted">{t('patientRecord.medicalAlerts.catalogEmpty')}</p>
              ) : (
                <select
                  value={diseaseCatalogId}
                  onChange={(e) => setDiseaseCatalogId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!!editing && editingDisease}
                >
                  <option value="">—</option>
                  {diseases.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          {alertType === 'OTHER' && (
            <label className="form-field">
              <span className="form-field__label">{t('patientRecord.medicalAlerts.customLabel')}</span>
              <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            </label>
          )}

          <label className="form-field">
            <span className="form-field__label">{t('common.note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetForm}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <ul className="medical-alerts-list">
          {alerts.length === 0 ? (
            <li className="muted">{t('patientRecord.medicalAlerts.empty')}</li>
          ) : (
            alerts.map((a) => (
              <li
                key={a.id}
                className={a.isActive ? 'medical-alerts-list__item' : 'medical-alerts-list__item medical-alerts-list__item--inactive'}
              >
                <span>
                  {alertDisplayLabel(a, t)}
                  {!a.isActive && ` (${t('patientRecord.medicalAlerts.inactive')})`}
                  {a.note ? ` — ${a.note}` : ''}
                </span>
                {canManage && a.isActive && (
                  <span className="medical-alerts-list__actions">
                    <button type="button" className="icon-btn" title={t('common.edit') ?? ''} onClick={() => startEdit(a)}>
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('patientRecord.medicalAlerts.deactivate') ?? ''}
                      onClick={() => deactivateMutation.mutate(a.id)}
                      disabled={deactivateMutation.isPending}
                    >
                      <Archive size={12} />
                    </button>
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
