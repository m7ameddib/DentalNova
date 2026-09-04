import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Plus, Printer, Save, Settings2, X } from 'lucide-react';
import { patientsApi } from '@/api/patients.api';
import { prescriptionsApi, PrescriptionItemPayload } from '@/api/prescriptions.api';
import { medicationCatalogApi } from '@/api/medication-catalog.api';
import { PrescriptionPrintable } from '@/components/patient-record/PrintableTemplates';
import { ManageMedicationsModal } from '@/components/patient-record/ManageMedicationsModal';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { getErrorMessage } from '@/utils/errors';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { MedicationCatalogItem, Prescription } from '@/types/domain';

const CATEGORY_ORDER = ['ANTIBIOTICS', 'PAINKILLERS', 'ANTI_INFLAMMATORY', 'MOUTHWASH', 'OTHER'] as const;

interface DraftItem {
  tempId: string;
  medicineName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}

function newTempId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromCatalog(med: MedicationCatalogItem): DraftItem {
  return {
    tempId: newTempId(),
    medicineName: med.strengthForm ? `${med.name} — ${med.strengthForm}` : med.name,
    dose: med.defaultDose ?? '',
    frequency: med.defaultFrequency ?? '',
    duration: med.defaultDuration ?? '',
    instructions: med.defaultInstructions ?? '',
  };
}

export function PrescriptionBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const currentUser = useAuthStore((s) => s.user);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [managingCatalog, setManagingCatalog] = useState(false);
  const [saved, setSaved] = useState<Prescription | null>(null);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId),
    enabled: !!patientId,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['medication-catalog'],
    queryFn: () => medicationCatalogApi.list(),
  });

  const { data: clinic } = useQuery({
    queryKey: ['clinic-print-info'],
    queryFn: () => loadClinicPrintInfo(),
  });

  const previewPrescription = useMemo((): Prescription | null => {
    const payload = items
      .filter((it) => it.medicineName.trim().length > 0)
      .map((it, index) => ({
        id: index,
        prescriptionId: 0,
        medicineName: it.medicineName.trim(),
        dose: it.dose.trim() || null,
        frequency: it.frequency.trim() || null,
        duration: it.duration.trim() || null,
        instructions: it.instructions.trim() || null,
        sortOrder: index,
      }));
    if (payload.length === 0) return null;
    return {
      id: 0,
      patientId: patient?.id ?? 0,
      doctorId: currentUser?.id ?? null,
      doctorName: currentUser?.fullName ?? null,
      type: 'MEDICATION',
      createdAt: new Date().toISOString(),
      items: payload,
    };
  }, [items, patient?.id, currentUser?.id, currentUser?.fullName]);

  const activeByCategory = useMemo(() => {
    const map = new Map<string, MedicationCatalogItem[]>();
    for (const med of catalog) {
      if (!med.isActive) continue;
      const list = map.get(med.category) ?? [];
      list.push(med);
      map.set(med.category, list);
    }
    return map;
  }, [catalog]);

  const createMutation = useMutation({
    mutationFn: (payload: PrescriptionItemPayload[]) =>
      prescriptionsApi.create(patientId, { type: 'MEDICATION', items: payload }),
    onSuccess: (prescription) => {
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', patientId] });
      setSaved(prescription);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function addFromCatalog(med: MedicationCatalogItem) {
    setItems((prev) => [...prev, fromCatalog(med)]);
  }

  function updateItem(tempId: string, field: keyof Omit<DraftItem, 'tempId'>, value: string) {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it)));
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function buildPayload(): PrescriptionItemPayload[] {
    return items
      .filter((it) => it.medicineName.trim().length > 0)
      .map((it) => ({
        medicineName: it.medicineName.trim(),
        dose: it.dose.trim() || undefined,
        frequency: it.frequency.trim() || undefined,
        duration: it.duration.trim() || undefined,
        instructions: it.instructions.trim() || undefined,
      }));
  }

  function handleSave() {
    const payload = buildPayload();
    if (payload.length === 0) {
      setError(t('prescriptionBuilder.validation.medicineRequired'));
      return;
    }
    createMutation.mutate(payload);
  }

  async function handlePrintDraft() {
    if (!patient) return;
    const payload = buildPayload();
    if (payload.length === 0) return;
    const clinicInfo = clinic ?? (await loadClinicPrintInfo());
    const draft: Prescription = {
      id: 0,
      patientId: patient.id,
      doctorId: currentUser?.id ?? null,
      doctorName: currentUser?.fullName ?? null,
      type: 'MEDICATION',
      createdAt: new Date().toISOString(),
      items: payload.map((it, index) => ({
        id: index,
        prescriptionId: 0,
        medicineName: it.medicineName,
        dose: it.dose ?? null,
        frequency: it.frequency ?? null,
        duration: it.duration ?? null,
        instructions: it.instructions ?? null,
        sortOrder: index,
      })),
    };
    print(<PrescriptionPrintable patient={patient} prescription={draft} clinic={clinicInfo} language={language} />);
  }

  async function handlePrintSaved() {
    if (!patient || !saved) return;
    const clinicInfo = clinic ?? (await loadClinicPrintInfo());
    print(<PrescriptionPrintable patient={patient} prescription={saved} clinic={clinicInfo} language={language} />);
  }

  function startNewPrescription() {
    setItems([]);
    setSaved(null);
    setError(null);
  }

  function backToPatient() {
    navigate(`/patients/${patientId}`);
  }

  if (!patient) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="prescription-builder-page">
      <div className="prescription-builder-page__header">
        <button type="button" className="icon-btn" title={t('prescriptionBuilder.backToPatient') ?? ''} onClick={backToPatient}>
          <ArrowLeft size={18} />
        </button>
        <div className="prescription-builder-page__title">
          <ClipboardList size={18} />
          <h1>{t('prescriptionBuilder.title')}</h1>
        </div>
        <div className="prescription-builder-page__meta">
          <span className="prescription-builder-page__meta-item">
            <span className="muted">{t('receipt.patient')}:</span> {patient.fullName}
          </span>
          <span className="prescription-builder-page__meta-item">
            <span className="muted">{t('receipt.fileNumber')}:</span> {patient.fileNumber}
          </span>
          <span className="prescription-builder-page__meta-item">
            <span className="muted">{t('prescriptionPrint.doctor')}:</span> {currentUser?.fullName ?? '—'}
          </span>
          {patient.weightKg != null && (
            <span className="prescription-builder-page__meta-item">
              <span className="muted">{t('prescriptionPrint.weight')}:</span> {patient.weightKg}{' '}
              {t('patientRecord.patient.weightUnit')}
            </span>
          )}
          <span className="prescription-builder-page__meta-item">
            <span className="muted">{t('common.date')}:</span> {formatDateDisplay(todayIso(), language)}
          </span>
        </div>
      </div>

      {saved ? (
        <div className="prescription-builder-saved">
          <div className="prescription-builder-saved__banner">
            <ClipboardList size={18} />
            <span>{t('prescriptionBuilder.savedHint')}</span>
          </div>
          <div className="form-actions form-actions--start">
            <button type="button" className="btn btn--primary" onClick={handlePrintSaved}>
              <Printer size={14} /> {t('common.print')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={startNewPrescription}>
              <Plus size={14} /> {t('prescriptionBuilder.newPrescription')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={backToPatient}>
              {t('prescriptionBuilder.backToPatient')}
            </button>
          </div>
        </div>
      ) : (
        <div className="prescription-builder">
          <aside className="prescription-builder__catalog">
            <div className="prescription-builder__catalog-header">
              <span className="prescription-builder__catalog-title">{t('prescriptionBuilder.catalogTitle')}</span>
              <button
                type="button"
                className="icon-btn icon-btn--small"
                title={t('prescriptionBuilder.manageMedications') ?? ''}
                onClick={() => setManagingCatalog(true)}
              >
                <Settings2 size={13} />
              </button>
            </div>

            {CATEGORY_ORDER.map((category) => {
              const meds = activeByCategory.get(category) ?? [];
              if (meds.length === 0) return null;
              return (
                <div className="medication-category" key={category}>
                  <span className="medication-category__title">{t(`prescriptionBuilder.categories.${category}`)}</span>
                  <div className="medication-grid">
                    {meds.map((med) => (
                      <button
                        type="button"
                        key={med.id}
                        className="medication-card"
                        onClick={() => addFromCatalog(med)}
                      >
                        <span className="medication-card__name">{med.name}</span>
                        {med.strengthForm && <span className="medication-card__form">{med.strengthForm}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>

          <main className="prescription-builder__preview">
            <div className="prescription-live-preview-card">
              {previewPrescription && clinic ? (
                <PrescriptionPrintable
                  patient={patient}
                  prescription={previewPrescription}
                  clinic={clinic}
                  language={language}
                  preview
                />
              ) : (
                <p className="muted prescription-live-preview__empty">{t('prescriptionBuilder.emptyHint')}</p>
              )}
            </div>

            {items.length > 0 && (
              <div className="prescription-live-preview__items">
                {items.map((item) => (
                  <div className="prescription-preview-item" key={item.tempId}>
                    <div className="prescription-preview-item__header">
                      <input
                        className="prescription-preview-item__name"
                        value={item.medicineName}
                        onChange={(e) => updateItem(item.tempId, 'medicineName', e.target.value)}
                        placeholder={t('patientRecord.prescription.medicineNamePlaceholder') ?? ''}
                      />
                      <button
                        type="button"
                        className="icon-btn icon-btn--small icon-btn--danger"
                        title={t('patientRecord.prescription.removeMedicine') ?? ''}
                        onClick={() => removeItem(item.tempId)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="prescription-preview-item__grid">
                      <label className="form-field">
                        <span className="form-field__label">{t('prescriptionPrint.dose')}</span>
                        <input value={item.dose} onChange={(e) => updateItem(item.tempId, 'dose', e.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('prescriptionPrint.frequency')}</span>
                        <input
                          value={item.frequency}
                          onChange={(e) => updateItem(item.tempId, 'frequency', e.target.value)}
                        />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('prescriptionPrint.duration')}</span>
                        <input
                          value={item.duration}
                          onChange={(e) => updateItem(item.tempId, 'duration', e.target.value)}
                        />
                      </label>
                    </div>
                    <label className="form-field">
                      <span className="form-field__label">{t('prescriptionPrint.instructions')}</span>
                      <input
                        value={item.instructions}
                        onChange={(e) => updateItem(item.tempId, 'instructions', e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-actions form-actions--start prescription-builder__actions">
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={createMutation.isPending}>
                <Save size={14} /> {t('patientRecord.prescription.save')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={handlePrintDraft} disabled={items.length === 0}>
                <Printer size={14} /> {t('common.print')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={backToPatient}>
                {t('common.cancel')}
              </button>
            </div>
          </main>
        </div>
      )}

      {managingCatalog && <ManageMedicationsModal onClose={() => setManagingCatalog(false)} />}
    </div>
  );
}
