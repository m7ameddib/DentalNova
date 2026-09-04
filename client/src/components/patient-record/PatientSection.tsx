import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { User, UserPlus, Printer, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { FormField } from '@/components/common/FormField';
import { Modal } from '@/components/common/Modal';
import { PatientSearchBox } from '@/components/patient-record/PatientSearchBox';
import { AreaPicker } from '@/components/patient-record/AreaPicker';
import { PatientRecordPrintable } from '@/components/patient-record/PrintableTemplates';
import type { ToothTreatmentBadge } from '@/components/patient-record/odontogram/types';
import { patientsApi, CreatePatientPayload, UpdatePatientPayload } from '@/api/patients.api';
import { areasApi } from '@/api/settings.api';
import { guarantorsApi } from '@/api/guarantors.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { openWhatsApp } from '@/utils/whatsapp';
import { calculateAge, formatDateDisplay } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { getAreaTextForEdit, getPatientAreaDisplay, resolveAreaFields } from '@/utils/patientArea';
import { Patient, PatientDetail } from '@/types/domain';

interface DuplicateInfo {
  existingPatients: Patient[];
  pendingPayload: CreatePatientPayload;
}

export function PatientSection({
  patient,
  forceAdd,
}: {
  patient: PatientDetail | null;
  /** True when the route explicitly requests the add-patient form (e.g. /patients/new). */
  forceAdd?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const canCreate = usePermission(PERMISSIONS.PATIENTS_CREATE);
  const canEdit = usePermission(PERMISSIONS.PATIENTS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PATIENTS_DELETE);

  const [mode, setMode] = useState<'view' | 'add' | 'edit' | 'empty'>(
    patient ? 'view' : forceAdd ? 'add' : 'empty',
  );
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [approxAge, setApproxAge] = useState('');
  const [gender, setGender] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [guarantorId, setGuarantorId] = useState<number | ''>('');
  const [areaText, setAreaText] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: () => areasApi.listActive(),
  });

  const { data: guarantors = [] } = useQuery({
    queryKey: ['guarantors'],
    queryFn: () => guarantorsApi.listActive(),
  });

  const createMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: (newPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate(`/patients/${newPatient.id}`, { replace: true });
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        setDuplicate({
          existingPatients: err.response.data.existingPatients ?? [],
          pendingPayload: buildCreatePayload(),
        });
        return;
      }
      setSubmitError(getErrorMessage(err, t('common.error')));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePatientPayload) => patientsApi.update(patient!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient!.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setMode('view');
    },
    onError: (err) => {
      setSubmitError(getErrorMessage(err, t('common.error')));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => patientsApi.archive(patient!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-archived'] });
      queryClient.removeQueries({ queryKey: ['patient', patient!.id] });
      setConfirmDelete(false);
      navigate('/', { replace: true });
    },
    onError: (err) => {
      setDeleteError(getErrorMessage(err, t('common.error')));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => patientsApi.restore(patient!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient!.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (err) => {
      setSubmitError(getErrorMessage(err, t('common.error')));
    },
  });

  function buildCreatePayload(): CreatePatientPayload {
    const areaFields = resolveAreaFields(areaText, areas);
    return {
      fullName: fullName.trim(),
      phone: phone.trim(),
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      approxAge: dateOfBirth ? undefined : approxAge ? Number(approxAge) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      guarantorId: guarantorId ? Number(guarantorId) : undefined,
      areaId: areaFields.areaId ?? undefined,
      address: areaFields.address ?? undefined,
      generalNotes: generalNotes.trim() || undefined,
    };
  }

  function buildUpdatePayload(): UpdatePatientPayload {
    const areaFields = resolveAreaFields(areaText, areas);
    return {
      fullName: fullName.trim(),
      phone: phone.trim(),
      gender: gender || undefined,
      dateOfBirth: dateOfBirth || undefined,
      approxAge: dateOfBirth ? undefined : approxAge ? Number(approxAge) : undefined,
      weightKg: weightKg ? Number(weightKg) : null,
      guarantorId: guarantorId ? Number(guarantorId) : null,
      areaId: areaFields.areaId ?? undefined,
      address: areaFields.address ?? undefined,
      generalNotes: generalNotes.trim() || undefined,
    };
  }

  function resetForm() {
    setFullName('');
    setPhone('');
    setDateOfBirth('');
    setApproxAge('');
    setGender('');
    setWeightKg('');
    setGuarantorId('');
    setAreaText('');
    setGeneralNotes('');
    setErrors({});
    setSubmitError(null);
    setDuplicate(null);
  }

  function handleCancel() {
    resetForm();
    if (mode === 'edit') {
      setMode('view');
      return;
    }
    setMode(patient ? 'view' : 'empty');
    if (forceAdd) navigate('/', { replace: true });
  }

  function startAdd() {
    resetForm();
    setMode('add');
  }

  function startEdit() {
    if (!patient) return;
    setFullName(patient.fullName);
    setPhone(patient.phone);
    setDateOfBirth(patient.dateOfBirth ?? '');
    setApproxAge(patient.approxAge != null ? String(patient.approxAge) : '');
    setGender(patient.gender ?? '');
    setWeightKg(patient.weightKg != null ? String(patient.weightKg) : '');
    setGuarantorId(patient.guarantorId ?? '');
    setAreaText(getAreaTextForEdit(patient, areas));
    setGeneralNotes(patient.generalNotes ?? '');
    setErrors({});
    setSubmitError(null);
    setDuplicate(null);
    setMode('edit');
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = t('patientRecord.patient.validation.fullNameRequired');
    if (!phone.trim()) next.phone = t('patientRecord.patient.validation.phoneRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setDuplicate(null);
    setSubmitError(null);
    if (mode === 'edit' && patient) {
      updateMutation.mutate(buildUpdatePayload());
    } else {
      createMutation.mutate(buildCreatePayload());
    }
  }

  function handleAddAsFamilyMember(existingPatientId: number) {
    if (!duplicate) return;
    createMutation.mutate({ ...duplicate.pendingPayload, linkFamilyOfPatientId: existingPatientId });
  }

  async function handlePrintPatientFile() {
    if (!patient) return;
    const clinic = await loadClinicPrintInfo();
    const [treatments, summary] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['patient-treatments', patient.id],
        queryFn: () => patientsApi.treatments(patient.id),
      }),
      queryClient.fetchQuery({
        queryKey: ['account-summary', patient.id],
        queryFn: () => patientsApi.accountSummary(patient.id),
      }),
    ]);

    const toothMap = new Map<number, ToothTreatmentBadge[]>();
    for (const treatment of treatments) {
      if (treatment.status === 'VOID') continue;
      const teeth =
        treatment.teeth.length > 0 ? treatment.teeth : treatment.toothNumber ? [treatment.toothNumber] : [];
      for (const tooth of teeth) {
        const list = toothMap.get(tooth) ?? [];
        list.push({
          abbreviation: treatment.treatmentAbbreviation,
          colorHex: treatment.treatmentColor,
          completed: treatment.status === 'COMPLETED',
        });
        toothMap.set(tooth, list);
      }
    }

    if (!summary) return;

    print(
      <PatientRecordPrintable
        patient={patient}
        treatments={treatments}
        summary={summary}
        toothMap={toothMap}
        clinic={clinic}
        language={language}
      />,
    );
  }

  function handleWhatsAppPatient() {
    openWhatsApp(patient?.phone);
  }

  function openDeleteConfirm() {
    setDeleteError(null);
    setConfirmDelete(true);
  }

  function closeDeleteConfirm() {
    if (archiveMutation.isPending) return;
    setConfirmDelete(false);
  }

  if (mode === 'empty') {
    return (
      <SectionCard
        title={t('patientRecord.sections.patient')}
        icon={<User size={16} />}
        onAdd={canCreate ? startAdd : undefined}
        addTitle={t('patients.newPatient') ?? ''}
        className="section-card--patient"
      >
        <div className="patient-search-row">
          <PatientSearchBox />
        </div>
        <div className="patient-empty-state">
          <UserPlus size={28} className="patient-empty-state__icon" />
          <p>{t('patientRecord.patient.emptyStateTitle')}</p>
          <span className="muted">{t('patientRecord.patient.emptyStateHint')}</span>
        </div>
      </SectionCard>
    );
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <SectionCard
        title={
          mode === 'edit'
            ? t('patientRecord.patient.editTitle')
            : patient
              ? t('patientRecord.sections.patient')
              : t('patientRecord.patient.addTitle')
        }
        icon={<User size={16} />}
        className="section-card--patient"
      >
        <div className="patient-search-row">
          <PatientSearchBox />
        </div>
        {duplicate ? (
          <div className="duplicate-phone-prompt">
            <h4>{t('patientRecord.patient.duplicateTitle')}</h4>
            <p className="muted">{t('patientRecord.patient.duplicateMessage')}</p>
            <ul className="duplicate-phone-prompt__list">
              {duplicate.existingPatients.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.fullName}</strong>
                    <span className="muted"> · {p.fileNumber} · {p.phone}</span>
                  </div>
                  <div className="duplicate-phone-prompt__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      {t('patientRecord.patient.openExisting')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => handleAddAsFamilyMember(p.id)}
                    >
                      {t('patientRecord.patient.addAsFamilyMember')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setDuplicate(null)}>
                {t('common.back')}
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-form">
            <FormField label={t('patients.fullName')} required error={errors.fullName}>
              <input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('patientRecord.patient.fullNamePlaceholder') ?? ''}
              />
            </FormField>

            <FormField label={t('patientRecord.patient.phone')} required error={errors.phone}>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('patientRecord.patient.phonePlaceholder') ?? ''}
              />
            </FormField>

            <div className="inline-form__row">
              <FormField label={t('patientRecord.patient.dob')} className="inline-form__col">
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    if (e.target.value) setApproxAge('');
                  }}
                />
              </FormField>
              <FormField label={t('patientRecord.patient.age')} className="inline-form__col inline-form__col--small">
                <input
                  type="number"
                  min={0}
                  value={dateOfBirth ? calculateAge(dateOfBirth) : approxAge}
                  onChange={(e) => setApproxAge(e.target.value)}
                  placeholder={t('patientRecord.patient.agePlaceholder') ?? ''}
                  disabled={!!dateOfBirth}
                  readOnly={!!dateOfBirth}
                />
              </FormField>
            </div>

            <FormField label={t('patientRecord.patient.gender')}>
              <div className="gender-radio-group">
                <label className="gender-radio-group__option">
                  <input
                    type="radio"
                    name="patientGender"
                    value="MALE"
                    checked={gender === 'MALE'}
                    onChange={() => setGender('MALE')}
                  />
                  <span>{t('gender.MALE')}</span>
                </label>
                <label className="gender-radio-group__option">
                  <input
                    type="radio"
                    name="patientGender"
                    value="FEMALE"
                    checked={gender === 'FEMALE'}
                    onChange={() => setGender('FEMALE')}
                  />
                  <span>{t('gender.FEMALE')}</span>
                </label>
              </div>
            </FormField>

            <div className="inline-form__row">
              <FormField label={t('patientRecord.patient.weight')} className="inline-form__col inline-form__col--small">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder={t('patientRecord.patient.weightPlaceholder') ?? ''}
                />
              </FormField>
              <FormField label={t('patientRecord.patient.guarantor')} className="inline-form__col">
                <select
                  value={guarantorId}
                  onChange={(e) => setGuarantorId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">{t('patientRecord.patient.noGuarantor')}</option>
                  {guarantors.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label={t('patientRecord.patient.area')}>
              <AreaPicker value={areaText} onChange={setAreaText} areas={areas} />
            </FormField>

            <FormField label={t('patientRecord.patient.generalNotes')}>
              <textarea
                rows={2}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder={t('patientRecord.patient.generalNotesPlaceholder') ?? ''}
              />
            </FormField>

            {submitError && <div className="form-error-banner">{submitError}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={handleCancel}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {mode === 'edit' ? t('patientRecord.patient.saveChanges') : t('patientRecord.patient.save')}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    );
  }

  // ---- view mode (patient is guaranteed non-null here) ----
  const p = patient!;
  const age = p.dateOfBirth ? calculateAge(p.dateOfBirth) : p.approxAge;
  const areaName = getPatientAreaDisplay(p, areas);

  return (
    <>
      <SectionCard
        title={t('patientRecord.sections.patient')}
        icon={<User size={16} />}
        headerExtra={
          canEdit || canDelete ? (
            <div className="section-card__header-actions">
              {canEdit && (
                <button
                  type="button"
                  className="icon-btn icon-btn--small"
                  title={t('patientRecord.patient.editTitle') ?? ''}
                  onClick={startEdit}
                >
                  <Pencil size={13} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="icon-btn icon-btn--small icon-btn--danger"
                  title={t('patientRecord.patient.deleteTitle') ?? ''}
                  onClick={openDeleteConfirm}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ) : undefined
        }
        onAdd={canCreate ? startAdd : undefined}
        addTitle={t('patients.newPatient') ?? ''}
        className="section-card--patient"
      >
        <div className="patient-search-row">
          <PatientSearchBox />
        </div>

        <div className="patient-view">
          <div className="patient-view__title-row">
            <h2 className="patient-view__name">{p.fullName}</h2>
            <button
              type="button"
              className="icon-btn icon-btn--small"
              title={t('patientRecordPrint.printAction') ?? ''}
              onClick={handlePrintPatientFile}
            >
              <Printer size={13} />
            </button>
          </div>
          <span className="patient-view__file-number">
            {t('patientRecord.patient.fileNumber')}: {p.fileNumber}
          </span>

          {p.archivedAt && (
            <div className="form-error-banner patient-view__archived-banner">
              <span>{t('patientRecord.patient.archivedBanner')}</span>
              {canDelete && (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => restoreMutation.mutate()}
                  disabled={restoreMutation.isPending}
                >
                  {t('patientRecord.patient.restorePatient')}
                </button>
              )}
            </div>
          )}

          <dl className="patient-view__fields">
            <div>
              <dt>{t('patientRecord.patient.phone')}</dt>
              <dd className="patient-view__phone-row">
                <span>{p.phone}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--small icon-btn--whatsapp"
                  title={p.phone ? (t('whatsapp.openConversation') ?? '') : (t('whatsapp.noPhone') ?? '')}
                  disabled={!p.phone}
                  onClick={handleWhatsAppPatient}
                >
                  <MessageCircle size={13} />
                </button>
              </dd>
            </div>
            {p.dateOfBirth && (
              <div>
                <dt>{t('patientRecord.patient.dob')}</dt>
                <dd>{formatDateDisplay(p.dateOfBirth, language)}</dd>
              </div>
            )}
            {age != null && (
              <div>
                <dt>{t('patientRecord.patient.age')}</dt>
                <dd>
                  {age} {t('common.years')}
                </dd>
              </div>
            )}
            {p.gender && (
              <div>
                <dt>{t('patientRecord.patient.gender')}</dt>
                <dd>{t(`gender.${p.gender}`)}</dd>
              </div>
            )}
            {p.weightKg != null && (
              <div>
                <dt>{t('patientRecord.patient.weight')}</dt>
                <dd>
                  {p.weightKg} {t('patientRecord.patient.weightUnit')}
                </dd>
              </div>
            )}
            {p.guarantorId && (
              <div>
                <dt>{t('patientRecord.patient.guarantor')}</dt>
                <dd>{guarantors.find((g) => g.id === p.guarantorId)?.name ?? '—'}</dd>
              </div>
            )}
            {areaName && (
              <div>
                <dt>{t('patientRecord.patient.area')}</dt>
                <dd>{areaName}</dd>
              </div>
            )}
            <div>
              <dt>{t('patientRecord.patient.generalNotes')}</dt>
              <dd>
                {p.generalNotes || <span className="muted">{t('patientRecord.patient.noGeneralNotes')}</span>}
              </dd>
            </div>
          </dl>

          {p.familyMembers.length > 0 && (
            <div className="patient-view__family">
              <span className="muted">{t('patientRecord.patient.familyMembers')}</span>
              <ul>
                {p.familyMembers.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="link-btn" onClick={() => navigate(`/patients/${m.id}`)}>
                      {m.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {confirmDelete && (
        <Modal
          title={t('patientRecord.patient.deleteTitle')}
          icon={<Trash2 size={16} />}
          onClose={closeDeleteConfirm}
        >
          <p>{t('patientRecord.patient.deleteWarning', { name: p.fullName })}</p>
          <p className="muted">{t('patientRecord.patient.deletePermanentNote')}</p>
          {deleteError && <div className="form-error-banner">{deleteError}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={closeDeleteConfirm} disabled={archiveMutation.isPending}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              {t('patientRecord.patient.deleteConfirmAction')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
