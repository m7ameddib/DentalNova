import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Printer, Radiation, Save, X } from 'lucide-react';
import { patientsApi } from '@/api/patients.api';
import { prescriptionsApi, PrescriptionItemPayload } from '@/api/prescriptions.api';
import { treatmentsApi } from '@/api/treatments.api';
import { XrayPrescriptionPrintable } from '@/components/patient-record/PrintableTemplates';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { getErrorMessage } from '@/utils/errors';
import { formatDateDisplay, todayIso } from '@/utils/date';
import { Prescription, TreatmentType } from '@/types/domain';

interface DraftStudy {
  tempId: string;
  studyName: string;
  teeth: string;
  notes: string;
}

function newTempId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fromStudyType(type: TreatmentType): DraftStudy {
  return {
    tempId: newTempId(),
    studyName: type.label,
    teeth: '',
    notes: '',
  };
}

export function XrayPrescriptionBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const print = usePrintStore((s) => s.print);
  const currentUser = useAuthStore((s) => s.user);

  const [items, setItems] = useState<DraftStudy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Prescription | null>(null);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.getById(patientId),
    enabled: !!patientId,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ['treatment-types-catalog'],
    queryFn: () => treatmentsApi.listCatalog(),
  });

  const { data: clinic } = useQuery({
    queryKey: ['clinic-print-info'],
    queryFn: () => loadClinicPrintInfo(),
  });

  const xrayStudies = useMemo(
    () =>
      catalog.filter(
        (type) =>
          type.isActive &&
          (type.category === 'DIAGNOSTIC' ||
            type.code.includes('XRAY') ||
            type.code === 'FMX' ||
            type.code === 'CBCT' ||
            type.code === 'OPG'),
      ),
    [catalog],
  );

  const previewPrescription = useMemo((): Prescription | null => {
    const payload = items
      .filter((it) => it.studyName.trim().length > 0)
      .map((it, index) => ({
        id: index,
        prescriptionId: 0,
        medicineName: it.studyName.trim(),
        dose: it.teeth.trim() || null,
        frequency: null,
        duration: null,
        instructions: it.notes.trim() || null,
        sortOrder: index,
      }));
    if (payload.length === 0) return null;
    return {
      id: 0,
      patientId: patient?.id ?? 0,
      doctorId: currentUser?.id ?? null,
      doctorName: currentUser?.fullName ?? null,
      type: 'XRAY',
      createdAt: new Date().toISOString(),
      items: payload,
    };
  }, [items, patient?.id, currentUser?.id, currentUser?.fullName]);

  const createMutation = useMutation({
    mutationFn: (payload: PrescriptionItemPayload[]) =>
      prescriptionsApi.create(patientId, { type: 'XRAY', items: payload }),
    onSuccess: (prescription) => {
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', patientId] });
      setSaved(prescription);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function addFromCatalog(type: TreatmentType) {
    setItems((prev) => [...prev, fromStudyType(type)]);
  }

  function updateItem(tempId: string, field: keyof Omit<DraftStudy, 'tempId'>, value: string) {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it)));
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function buildPayload(): PrescriptionItemPayload[] {
    return items
      .filter((it) => it.studyName.trim().length > 0)
      .map((it) => ({
        medicineName: it.studyName.trim(),
        dose: it.teeth.trim() || undefined,
        instructions: it.notes.trim() || undefined,
      }));
  }

  function handleSave() {
    const payload = buildPayload();
    if (payload.length === 0) {
      setError(t('xrayPrescriptionBuilder.validation.studyRequired'));
      return;
    }
    createMutation.mutate(payload);
  }

  async function handlePrintDraft() {
    if (!patient || !previewPrescription) return;
    const clinicInfo = clinic ?? (await loadClinicPrintInfo());
    print(
      <XrayPrescriptionPrintable
        patient={patient}
        prescription={previewPrescription}
        clinic={clinicInfo}
        language={language}
      />,
    );
  }

  async function handlePrintSaved() {
    if (!patient || !saved) return;
    const clinicInfo = clinic ?? (await loadClinicPrintInfo());
    print(
      <XrayPrescriptionPrintable patient={patient} prescription={saved} clinic={clinicInfo} language={language} />,
    );
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
        <button type="button" className="icon-btn" title={t('xrayPrescriptionBuilder.backToPatient') ?? ''} onClick={backToPatient}>
          <ArrowLeft size={18} />
        </button>
        <div className="prescription-builder-page__title">
          <Radiation size={18} />
          <h1>{t('xrayPrescriptionBuilder.title')}</h1>
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
          <span className="prescription-builder-page__meta-item">
            <span className="muted">{t('common.date')}:</span> {formatDateDisplay(todayIso(), language)}
          </span>
        </div>
      </div>

      {saved ? (
        <div className="prescription-builder-saved">
          <div className="prescription-builder-saved__banner">
            <Radiation size={18} />
            <span>{t('xrayPrescriptionBuilder.savedHint')}</span>
          </div>
          <div className="form-actions form-actions--start">
            <button type="button" className="btn btn--primary" onClick={handlePrintSaved}>
              <Printer size={14} /> {t('common.print')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={startNewPrescription}>
              <Plus size={14} /> {t('xrayPrescriptionBuilder.newPrescription')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={backToPatient}>
              {t('xrayPrescriptionBuilder.backToPatient')}
            </button>
          </div>
        </div>
      ) : (
        <div className="prescription-builder">
          <aside className="prescription-builder__catalog">
            <div className="prescription-builder__catalog-header">
              <span className="prescription-builder__catalog-title">{t('xrayPrescriptionBuilder.catalogTitle')}</span>
            </div>

            {xrayStudies.length === 0 ? (
              <p className="muted">{t('xrayPrescriptionBuilder.noStudies')}</p>
            ) : (
              <div className="medication-grid">
                {xrayStudies.map((study) => (
                  <button type="button" key={study.id} className="medication-card" onClick={() => addFromCatalog(study)}>
                    <span className="medication-card__name">{study.label}</span>
                    <span className="medication-card__form">{study.abbreviation}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="prescription-builder__preview">
            <div className="prescription-live-preview-card">
              {previewPrescription && clinic ? (
                <XrayPrescriptionPrintable
                  patient={patient}
                  prescription={previewPrescription}
                  clinic={clinic}
                  language={language}
                  preview
                />
              ) : (
                <p className="muted prescription-live-preview__empty">{t('xrayPrescriptionBuilder.emptyHint')}</p>
              )}
            </div>

            {items.length > 0 && (
              <div className="prescription-live-preview__items">
                {items.map((item) => (
                  <div className="prescription-preview-item" key={item.tempId}>
                    <div className="prescription-preview-item__header">
                      <input
                        className="prescription-preview-item__name"
                        value={item.studyName}
                        onChange={(e) => updateItem(item.tempId, 'studyName', e.target.value)}
                        placeholder={t('xrayPrescriptionBuilder.studyNamePlaceholder') ?? ''}
                      />
                      <button
                        type="button"
                        className="icon-btn icon-btn--small icon-btn--danger"
                        title={t('xrayPrescriptionBuilder.removeStudy') ?? ''}
                        onClick={() => removeItem(item.tempId)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <label className="form-field">
                      <span className="form-field__label">{t('xrayPrescriptionPrint.teeth')}</span>
                      <input
                        value={item.teeth}
                        onChange={(e) => updateItem(item.tempId, 'teeth', e.target.value)}
                        placeholder={t('xrayPrescriptionBuilder.teethPlaceholder') ?? ''}
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{t('xrayPrescriptionBuilder.notes')}</span>
                      <input
                        value={item.notes}
                        onChange={(e) => updateItem(item.tempId, 'notes', e.target.value)}
                        placeholder={t('xrayPrescriptionBuilder.notesPlaceholder') ?? ''}
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
    </div>
  );
}
