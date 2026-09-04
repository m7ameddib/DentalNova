import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { labCasesApi, CreateLabCasePayload, UpdateLabCasePayload } from '@/api/lab-cases.api';
import { patientsApi } from '@/api/patients.api';
import { Modal } from '@/components/common/Modal';
import { DentalChart } from '@/components/patient-record/DentalChart';
import { LabCaseFinancialSection } from '@/components/lab-cases/LabCaseFinancialSection';
import { LabCaseStatus, LabCaseWithDetails, Patient, PatientTreatment } from '@/types/domain';
import { todayIso } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';

const STATUSES: LabCaseStatus[] = [
  'PENDING',
  'SENT_TO_LAB',
  'IN_PROGRESS',
  'RECEIVED_FROM_LAB',
  'DELIVERED_TO_PATIENT',
  'CANCELLED',
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editCase?: LabCaseWithDetails | null;
  presetPatient?: Patient | null;
};

export function LabCaseFormModal({ open, onClose, onSaved, editCase, presetPatient }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editCase;

  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(presetPatient ?? null);
  const [labName, setLabName] = useState('');
  const [workTypeCode, setWorkTypeCode] = useState('');
  const [workTypeCustom, setWorkTypeCustom] = useState('');
  const [status, setStatus] = useState<LabCaseStatus>('PENDING');
  const [sentDate, setSentDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [treatmentId, setTreatmentId] = useState<number | ''>('');
  const [labCost, setLabCost] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: workTypes = [] } = useQuery({
    queryKey: ['lab-work-types'],
    queryFn: () => labCasesApi.workTypes(),
    enabled: open,
  });

  const { data: labNames = [] } = useQuery({
    queryKey: ['lab-names'],
    queryFn: () => labCasesApi.labNames(),
    enabled: open,
  });

  const { data: patientSearch = [] } = useQuery({
    queryKey: ['lab-case-patient-search', patientQuery],
    queryFn: () => patientsApi.search(patientQuery),
    enabled: open && !isEdit && !selectedPatient && patientQuery.trim().length >= 2,
  });

  const patientId = selectedPatient?.id ?? editCase?.patientId ?? null;

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments-lab', patientId],
    queryFn: () => patientsApi.treatments(patientId!),
    enabled: open && !!patientId,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editCase) {
      setSelectedPatient(null);
      setLabName(editCase.labName);
      setWorkTypeCode(editCase.workTypeCode);
      setWorkTypeCustom(editCase.workTypeCustom ?? '');
      setStatus(editCase.status);
      setSentDate(editCase.sentDate ?? '');
      setExpectedDeliveryDate(editCase.expectedDeliveryDate ?? '');
      setReceivedDate(editCase.receivedDate ?? '');
      setDeliveredDate(editCase.deliveredDate ?? '');
      setNotes(editCase.notes ?? '');
      setSelectedTeeth(editCase.teeth);
      setTreatmentId(editCase.patientTreatmentId ?? '');
      setLabCost(editCase.labCostCents ? String(editCase.labCostCents / 100) : '');
    } else {
      setSelectedPatient(presetPatient ?? null);
      setPatientQuery('');
      setLabName('');
      setWorkTypeCode(workTypes[0]?.code ?? '');
      setWorkTypeCustom('');
      setStatus('PENDING');
      setSentDate('');
      setExpectedDeliveryDate('');
      setReceivedDate('');
      setDeliveredDate('');
      setNotes('');
      setSelectedTeeth([]);
      setTreatmentId('');
      setLabCost('');
    }
  }, [open, editCase, presetPatient, workTypes]);

  const toothMap = useMemo(() => new Map<number, never>(), []);

  const saveMutation = useMutation({
    mutationFn: (payload: CreateLabCasePayload | { id: number; data: UpdateLabCasePayload }) => {
      if ('id' in payload) {
        return labCasesApi.update(payload.id, payload.data);
      }
      return labCasesApi.create(payload);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function toggleTooth(n: number) {
    setSelectedTeeth((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  }

  function treatmentLabel(tr: PatientTreatment) {
    const teeth = tr.teeth?.join(', ') ?? '';
    return teeth ? `${tr.treatmentLabel} — ${teeth}` : tr.treatmentLabel;
  }

  function handleSave() {
    if (!isEdit && !selectedPatient) {
      setError(t('labCases.validation.patientRequired'));
      return;
    }
    if (!labName.trim()) {
      setError(t('labCases.validation.labRequired'));
      return;
    }
    if (!workTypeCode) {
      setError(t('labCases.validation.workTypeRequired'));
      return;
    }
    if (workTypeCode === 'OTHER' && !workTypeCustom.trim()) {
      setError(t('labCases.validation.customWorkTypeRequired'));
      return;
    }
    if (selectedTeeth.length === 0) {
      setError(t('labCases.validation.teethRequired'));
      return;
    }

    const base = {
      labName: labName.trim(),
      workTypeCode,
      workTypeCustom: workTypeCode === 'OTHER' ? workTypeCustom.trim() : undefined,
      status,
      sentDate: sentDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      receivedDate: receivedDate || undefined,
      deliveredDate: deliveredDate || undefined,
      notes: notes.trim() || undefined,
      teeth: selectedTeeth,
      patientTreatmentId: treatmentId === '' ? undefined : Number(treatmentId),
      labCost: isEdit
        ? (labCost.trim() === '' ? 0 : Number(labCost))
        : labCost.trim()
          ? Number(labCost)
          : undefined,
    };

    if (isEdit && editCase) {
      saveMutation.mutate({ id: editCase.id, data: base });
    } else {
      saveMutation.mutate({ ...base, patientId: selectedPatient!.id });
    }
  }

  function handleStatusChange(next: LabCaseStatus) {
    setStatus(next);
    const today = todayIso();
    if (next === 'SENT_TO_LAB' && !sentDate) setSentDate(today);
    if (next === 'RECEIVED_FROM_LAB' && !receivedDate) setReceivedDate(today);
    if (next === 'DELIVERED_TO_PATIENT' && !deliveredDate) setDeliveredDate(today);
  }

  if (!open) return null;

  return (
    <Modal
      title={isEdit ? t('labCases.editCase') : t('labCases.addCase')}
      onClose={onClose}
      size="wide"
    >
      {!isEdit && !presetPatient && (
        <label className="form-field">
          <span className="form-field__label">{t('labCases.patient')}</span>
          {selectedPatient ? (
            <div className="selected-patient-chip">
              <span>
                {selectedPatient.fullName} · {selectedPatient.fileNumber}
              </span>
              <button type="button" className="link-btn" onClick={() => setSelectedPatient(null)}>
                {t('common.edit')}
              </button>
            </div>
          ) : (
            <>
              <input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder={t('common.searchPlaceholder') ?? ''}
              />
              {patientSearch.length > 0 && (
                <ul className="patient-search-dropdown">
                  {patientSearch.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <button type="button" className="link-btn" onClick={() => setSelectedPatient(p)}>
                        {p.fullName} · {p.fileNumber} · {p.phone}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </label>
      )}

      {(isEdit || presetPatient || selectedPatient) && (
        <p className="muted lab-case-form__patient">
          {isEdit ? `${editCase!.patientName} · ${editCase!.patientFileNumber}` : selectedPatient?.fullName}
        </p>
      )}

      <label className="form-field">
        <span className="form-field__label">{t('labCases.labName')}</span>
        <input
          list="lab-names-list"
          value={labName}
          onChange={(e) => setLabName(e.target.value)}
          placeholder={t('labCases.labNamePlaceholder') ?? ''}
        />
        <datalist id="lab-names-list">
          {labNames.map((l) => (
            <option key={l.id} value={l.name} />
          ))}
        </datalist>
      </label>

      <div className="inline-form__row">
        <label className="form-field inline-form__col">
          <span className="form-field__label">{t('labCases.workType')}</span>
          <select value={workTypeCode} onChange={(e) => setWorkTypeCode(e.target.value)}>
            <option value="">—</option>
            {workTypes.map((wt) => (
              <option key={wt.code} value={wt.code}>
                {wt.label}
              </option>
            ))}
          </select>
        </label>
        {workTypeCode === 'OTHER' && (
          <label className="form-field inline-form__col">
            <span className="form-field__label">{t('labCases.customWorkType')}</span>
            <input value={workTypeCustom} onChange={(e) => setWorkTypeCustom(e.target.value)} />
          </label>
        )}
      </div>

      {patientId && treatments.length > 0 && (
        <label className="form-field">
          <span className="form-field__label">{t('labCases.relatedTreatment')}</span>
          <select
            value={treatmentId}
            onChange={(e) => setTreatmentId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">{t('labCases.noTreatment')}</option>
            {treatments.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {treatmentLabel(tr)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="lab-case-form__teeth">
        <span className="form-field__label">{t('labCases.teeth')}</span>
        <DentalChart
          toothMap={toothMap}
          selectable
          selectedTeeth={selectedTeeth}
          onToggleTooth={toggleTooth}
        />
        {selectedTeeth.length > 0 && (
          <p className="muted">{selectedTeeth.join(', ')}</p>
        )}
      </div>

      <div className="inline-form__row">
        <label className="form-field inline-form__col">
          <span className="form-field__label">{t('labCases.sentDate')}</span>
          <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
        </label>
        <label className="form-field inline-form__col">
          <span className="form-field__label">{t('labCases.expectedDelivery')}</span>
          <input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
          />
        </label>
      </div>

      <div className="inline-form__row">
        <label className="form-field inline-form__col">
          <span className="form-field__label">{t('labCases.receivedDate')}</span>
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
        </label>
        <label className="form-field inline-form__col">
          <span className="form-field__label">{t('labCases.deliveredDate')}</span>
          <input type="date" value={deliveredDate} onChange={(e) => setDeliveredDate(e.target.value)} />
        </label>
      </div>

      <label className="form-field">
        <span className="form-field__label">{t('labCases.status')}</span>
        <select value={status} onChange={(e) => handleStatusChange(e.target.value as LabCaseStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`labCases.statuses.${s}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span className="form-field__label">{t('labCases.financial.labCost')}</span>
        <input type="number" min="0" step="0.01" value={labCost} onChange={(e) => setLabCost(e.target.value)} placeholder="0" />
      </label>

      {isEdit && editCase && (
        <LabCaseFinancialSection labCase={editCase} />
      )}

      <label className="form-field">
        <span className="form-field__label">{t('common.note')}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>

      {error && <div className="form-error-banner">{error}</div>}

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saveMutation.isPending}>
          {t('common.save')}
        </button>
      </div>
    </Modal>
  );
}
