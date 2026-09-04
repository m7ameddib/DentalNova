import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stethoscope, Trash2, FileText, History, Pencil } from 'lucide-react';
import { SectionCard } from '@/components/common/SectionCard';
import { Modal } from '@/components/common/Modal';
import { DentalChart } from './DentalChart';
import type { ToothTreatmentBadge } from './DentalChart';
import { treatmentsApi, UpdateTreatmentPayload } from '@/api/treatments.api';
import { patientsApi } from '@/api/patients.api';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { PatientTreatment, TreatmentStatus, Patient } from '@/types/domain';
import { TreatmentPlanModal } from './TreatmentPlanModal';
import { centsToAmount, formatMoney } from '@/utils/money';
import { formatDateDisplay, formatDateTimeDisplay, todayIso } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';
import {
  TreatmentScope,
  teethForScope,
  priceMultiplier,
  resolveScope,
  isJawScope,
} from '@/utils/teeth';
import { expandTreatmentDisplayRows, isPartialToothRemoval, buildPartialToothRemovalPayload, TreatmentDisplayRow } from '@/utils/treatment-display';

const STATUS_OPTIONS: TreatmentStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
const SCOPE_OPTIONS: TreatmentScope[] = ['SINGLE', 'UPPER_JAW', 'LOWER_JAW', 'ALL_TEETH'];
const COLLAPSED_HISTORY_LIMIT = 6;

export function TreatmentSection({ patientId, patient }: { patientId: number; patient: Patient }) {
  const { t } = useTranslation();
  const { language } = useUiStore();
  const queryClient = useQueryClient();
  const canCreate = usePermission(PERMISSIONS.TREATMENTS_CREATE);

  const [adding, setAdding] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [treatmentScope, setTreatmentScope] = useState<TreatmentScope>('SINGLE');
  const [treatmentDate, setTreatmentDate] = useState(todayIso());
  const [discount, setDiscount] = useState('');
  const [status, setStatus] = useState<Exclude<TreatmentStatus, 'VOID'>>('PLANNED');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [deletingRow, setDeletingRow] = useState<TreatmentDisplayRow | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showTreatmentPlan, setShowTreatmentPlan] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<PatientTreatment | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: treatments = [] } = useQuery({
    queryKey: ['patient-treatments', patientId],
    queryFn: () => patientsApi.treatments(patientId),
  });

  const { data: treatmentTypes = [] } = useQuery({
    queryKey: ['treatment-types'],
    queryFn: () => treatmentsApi.listTypes(),
  });

  const displayRows = useMemo(() => expandTreatmentDisplayRows(treatments), [treatments]);

  const toothMap = useMemo(() => {
    const map = new Map<number, ToothTreatmentBadge[]>();
    for (const treatment of treatments) {
      if (treatment.status === 'VOID') continue;
      const teeth = treatment.teeth.length > 0 ? treatment.teeth : treatment.toothNumber ? [treatment.toothNumber] : [];
      for (const tooth of teeth) {
        const list = map.get(tooth) ?? [];
        list.push({
          abbreviation: treatment.treatmentAbbreviation,
          colorHex: treatment.treatmentColor,
          completed: treatment.status === 'COMPLETED',
        });
        map.set(tooth, list);
      }
    }
    return map;
  }, [treatments]);

  const selectedType = treatmentTypes.find((type) => type.id === selectedTypeId) ?? null;
  const effectiveScope = resolveScope(treatmentScope, selectedType?.scope ?? null);
  const effectiveTeeth =
    effectiveScope === 'SINGLE' ? selectedTeeth : teethForScope(effectiveScope);
  const multiplier = priceMultiplier(effectiveScope, effectiveTeeth.length);
  const baseAmountCents = selectedType ? selectedType.defaultPriceCents * multiplier : 0;
  const discountCents = Math.round((Number(discount) || 0) * 100);
  const finalAmountCents = Math.max(0, baseAmountCents - discountCents);

  const invalidateTreatments = () => {
    queryClient.invalidateQueries({ queryKey: ['patient-treatments', patientId] });
    queryClient.invalidateQueries({ queryKey: ['account-summary', patientId] });
    queryClient.invalidateQueries({ queryKey: ['patient-follow-ups', patientId] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups-summary'] });
    queryClient.invalidateQueries({ queryKey: ['follow-ups-history'] });
  };

  const createMutation = useMutation({
    mutationFn: treatmentsApi.create,
    onSuccess: () => {
      invalidateTreatments();
      resetForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => treatmentsApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['patient-treatments', patientId] });
      const previous = queryClient.getQueryData<PatientTreatment[]>(['patient-treatments', patientId]);
      queryClient.setQueryData<PatientTreatment[]>(['patient-treatments', patientId], (old) =>
        (old ?? []).filter((item) => item.id !== id),
      );
      return { previous };
    },
    onSuccess: () => {
      setDeletingRow(null);
      setDeleteError(null);
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['patient-treatments', patientId], context.previous);
      }
      setDeleteError(getErrorMessage(err, t('common.error')));
    },
    onSettled: () => {
      invalidateTreatments();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status: newStatus }: { id: number; status: TreatmentStatus }) =>
      treatmentsApi.updateStatus(id, newStatus),
    onSuccess: () => {
      invalidateTreatments();
      setStatusError(null);
    },
    onError: (err) => setStatusError(getErrorMessage(err, t('common.error'))),
  });

  const splitStatusMutation = useMutation({
    mutationFn: async ({
      row,
      status: newStatus,
    }: {
      row: TreatmentDisplayRow;
      status: Exclude<TreatmentStatus, 'VOID'>;
    }) => {
      const tr = row.treatment;
      await treatmentsApi.update(tr.id, buildPartialToothRemovalPayload(row));
      await treatmentsApi.create({
        patientId: tr.patientId,
        treatmentTypeId: tr.treatmentTypeId,
        teeth: [row.tooth!],
        treatmentDate: tr.treatmentDate ?? tr.createdAt.slice(0, 10),
        treatmentScope: 'SINGLE',
        discount: row.discountCents / 100,
        status: newStatus,
        note: tr.note ?? undefined,
      });
    },
    onSuccess: () => {
      invalidateTreatments();
      setStatusError(null);
    },
    onError: (err) => setStatusError(getErrorMessage(err, t('common.error'))),
  });

  const removeToothMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTreatmentPayload }) =>
      treatmentsApi.update(id, payload),
    onSuccess: () => {
      invalidateTreatments();
      setDeletingRow(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTreatmentPayload }) =>
      treatmentsApi.update(id, payload),
    onSuccess: () => {
      invalidateTreatments();
      setEditingTreatment(null);
      setEditError(null);
    },
    onError: (err) => setEditError(getErrorMessage(err, t('common.error'))),
  });

  useEffect(() => {
    if (isJawScope(effectiveScope)) {
      setSelectedTeeth(teethForScope(effectiveScope));
    }
  }, [effectiveScope]);

  function resetForm() {
    setAdding(false);
    setSelectedTypeId(null);
    setSelectedTeeth([]);
    setTreatmentScope('SINGLE');
    setTreatmentDate(todayIso());
    setDiscount('');
    setStatus('PLANNED');
    setNote('');
    setError(null);
  }

  function toggleTooth(n: number) {
    if (effectiveScope !== 'SINGLE') return;
    setSelectedTeeth((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function handleScopeChange(scope: TreatmentScope) {
    setTreatmentScope(scope);
    if (scope !== 'SINGLE') {
      setSelectedTeeth(teethForScope(scope));
    }
  }

  function handleStatusChange(row: TreatmentDisplayRow, newStatus: TreatmentStatus) {
    if (newStatus === 'VOID') return;
    const tr = row.treatment;
    if (newStatus === tr.status) return;

    if (isPartialToothRemoval(row)) {
      splitStatusMutation.mutate({ row, status: newStatus });
      return;
    }
    updateStatusMutation.mutate({ id: tr.id, status: newStatus });
  }

  function handleSave() {
    setError(null);
    if (!selectedTypeId) {
      setError(t('patientRecord.treatment.validation.typeRequired'));
      return;
    }
    if (effectiveScope === 'SINGLE' && selectedTeeth.length === 0) {
      setError(t('patientRecord.treatment.validation.teethRequired'));
      return;
    }
    createMutation.mutate({
      patientId,
      treatmentTypeId: selectedTypeId,
      teeth: effectiveTeeth,
      treatmentDate,
      treatmentScope: effectiveScope,
      discount: Number(discount) || 0,
      status,
      note: note.trim() || undefined,
    });
  }

  function treatmentDisplayDate(tr: PatientTreatment): string {
    const dateIso = tr.treatmentDate ?? tr.createdAt.slice(0, 10);
    return formatDateDisplay(dateIso, language);
  }

  function handleConfirmDelete() {
    if (!deletingRow) return;
    if (isPartialToothRemoval(deletingRow)) {
      removeToothMutation.mutate({
        id: deletingRow.treatment.id,
        payload: buildPartialToothRemovalPayload(deletingRow),
      });
      return;
    }
    deleteMutation.mutate(deletingRow.treatment.id);
  }

  const deletePending = deleteMutation.isPending || removeToothMutation.isPending;

  return (
    <>
      <SectionCard
        title={t('patientRecord.sections.treatment')}
        icon={<Stethoscope size={16} />}
        onAdd={canCreate ? () => setAdding((v) => !v) : undefined}
        addTitle={t('patientRecord.treatment.addTitle') ?? ''}
        className="section-card--treatment"
        headerExtra={
          <button type="button" className="link-btn treatment-plan-open-btn" onClick={() => setShowTreatmentPlan(true)}>
            <FileText size={14} /> {t('patientRecord.treatmentPlan.open')}
          </button>
        }
      >
        <DentalChart
          toothMap={toothMap}
          selectable={adding && effectiveScope === 'SINGLE'}
          selectedTeeth={adding ? effectiveTeeth : selectedTeeth}
          onToggleTooth={toggleTooth}
          anatomical
        />

        {adding && (
          <div className="treatment-add-panel">
            <div className="treatment-add-panel__col">
              <span className="treatment-add-panel__step">{t('patientRecord.treatment.selectType')}</span>
              <div className="treatment-type-grid">
                {treatmentTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={
                      selectedTypeId === type.id
                        ? 'treatment-type-card treatment-type-card--selected'
                        : 'treatment-type-card'
                    }
                    style={{ borderColor: selectedTypeId === type.id ? type.colorHex : undefined }}
                    onClick={() => setSelectedTypeId(type.id)}
                  >
                    <span className="treatment-type-card__dot" style={{ backgroundColor: type.colorHex }} />
                    <span className="treatment-type-card__label">
                      {t(`patientRecord.treatmentTypes.${type.code}`, { defaultValue: type.label })}
                    </span>
                    <span className="treatment-type-card__price">{formatMoney(type.defaultPriceCents)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="treatment-add-panel__col treatment-add-panel__col--narrow">
              <label className="form-field">
                <span className="form-field__label">{t('patientRecord.treatment.treatmentDate')}</span>
                <input type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} />
              </label>

              <label className="form-field">
                <span className="form-field__label">{t('patientRecord.treatment.scope')}</span>
                <select
                  value={treatmentScope}
                  onChange={(e) => handleScopeChange(e.target.value as TreatmentScope)}
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`patientRecord.treatment.scopes.${s}`)}
                    </option>
                  ))}
                </select>
              </label>

              <span className="treatment-add-panel__step">{t('patientRecord.treatment.selectTeeth')}</span>
              <div className="selected-teeth-summary">
                {effectiveTeeth.length === 0 ? (
                  <span className="muted">{t('patientRecord.treatment.selectTeethHint')}</span>
                ) : (
                  <>
                    <span>
                      {t('patientRecord.treatment.selectedTeeth')}:{' '}
                      {[...effectiveTeeth].sort((a, b) => a - b).join(', ')}
                    </span>
                    {effectiveScope === 'SINGLE' && (
                      <button type="button" className="link-btn" onClick={() => setSelectedTeeth([])}>
                        {t('patientRecord.treatment.clearSelection')}
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="treatment-price-breakdown">
                <div className="treatment-price-breakdown__row">
                  <span className="muted">{t('patientRecord.treatment.baseAmount')}</span>
                  <span>{formatMoney(baseAmountCents)}</span>
                </div>
                <label className="form-field">
                  <span className="form-field__label">{t('patientRecord.treatment.discount')}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <div className="treatment-price-breakdown__row treatment-price-breakdown__row--final">
                  <span>{t('patientRecord.treatment.finalAmount')}</span>
                  <span>{formatMoney(finalAmountCents)}</span>
                </div>
              </div>

              <label className="form-field">
                <span className="form-field__label">{t('patientRecord.treatment.status')}</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as Exclude<TreatmentStatus, 'VOID'>)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`patientRecord.treatmentStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="form-field__label">{t('patientRecord.treatment.note')}</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('patientRecord.treatment.notePlaceholder') ?? ''}
                />
              </label>

              {error && <div className="form-error-banner">{error}</div>}

              <div className="form-actions">
                <button type="button" className="btn btn--ghost" onClick={resetForm}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                >
                  {t('patientRecord.treatment.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t('patientRecord.treatment.history')}
        icon={<History size={16} />}
        className="section-card--treatment-history"
      >
        <div className="treatment-history">
          {treatments.length > COLLAPSED_HISTORY_LIMIT && (
            <div className="treatment-history__header">
              <button type="button" className="link-btn" onClick={() => setShowAllHistory((v) => !v)}>
                {showAllHistory
                  ? t('patientRecord.treatment.showLess')
                  : t('patientRecord.treatment.showAll', { count: treatments.length })}
              </button>
            </div>
          )}
          {treatments.length === 0 ? (
            <p className="muted">{t('patientRecord.treatment.noHistory')}</p>
          ) : (
            <div className="treatment-history-table-wrap">
              <table className="treatment-history-table">
                <thead>
                  <tr>
                    <th>{t('patientRecord.treatment.columns.date')}</th>
                    <th>{t('patientRecord.treatment.columns.treatment')}</th>
                    <th>{t('patientRecord.treatment.columns.teeth')}</th>
                    <th>{t('patientRecord.treatment.columns.base')}</th>
                    <th>{t('patientRecord.treatment.columns.discount')}</th>
                    <th>{t('patientRecord.treatment.columns.final')}</th>
                    <th>{t('patientRecord.treatment.columns.status')}</th>
                    {canCreate && <th className="treatment-history-table__actions-col" />}
                  </tr>
                </thead>
                <tbody>
                  {(showAllHistory ? displayRows : displayRows.slice(0, COLLAPSED_HISTORY_LIMIT)).map(
                    (row) => {
                      const tr = row.treatment;
                      const treatmentLabel = t(`patientRecord.treatmentTypes.${tr.treatmentCode}`, {
                        defaultValue: tr.treatmentLabel,
                      });
                      const treatmentCell =
                        row.tooth != null
                          ? t('patientRecord.treatment.toothTreatmentLine', {
                              tooth: row.tooth,
                              treatment: treatmentLabel,
                            })
                          : treatmentLabel;
                      return (
                      <tr key={row.key} className={tr.status === 'VOID' ? 'treatment-row--void' : undefined}>
                        <td>{treatmentDisplayDate(tr)}</td>
                        <td>
                          <span className="treatment-history__badge" style={{ backgroundColor: tr.treatmentColor }}>
                            {tr.treatmentAbbreviation}
                          </span>
                          {treatmentCell}
                        </td>
                        <td>
                          {row.tooth != null
                            ? t('patientRecord.treatment.toothLine', { tooth: row.tooth })
                            : tr.teeth.length > 0
                              ? tr.teeth.join(', ')
                              : '—'}
                        </td>
                        <td>{formatMoney(row.baseAmountCents)}</td>
                        <td>{row.discountCents > 0 ? `-${centsToAmount(row.discountCents).toFixed(2)}` : '—'}</td>
                        <td className="treatment-history-table__final">{formatMoney(row.finalAmountCents)}</td>
                        <td>
                          {canCreate ? (
                            <select
                              className={`status-chip-select status-chip-select--${tr.status.toLowerCase()}`}
                              value={tr.status}
                              disabled={updateStatusMutation.isPending || splitStatusMutation.isPending}
                              onChange={(e) =>
                                handleStatusChange(row, e.target.value as TreatmentStatus)
                              }
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {t(`patientRecord.treatmentStatus.${s}`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`status-chip status-chip--${tr.status.toLowerCase()}`}>
                              {t(`patientRecord.treatmentStatus.${tr.status}`)}
                            </span>
                          )}
                          {tr.status === 'COMPLETED' && tr.completedAt && (
                            <div className="muted treatment-history__completed">
                              {t('patientRecord.treatment.completedMeta', {
                                date: formatDateTimeDisplay(tr.completedAt, language),
                                user: tr.completedByName ?? '—',
                              })}
                            </div>
                          )}
                        </td>
                        {canCreate && (
                          <td className="treatment-history-table__actions-col">
                            <button
                              type="button"
                              className="icon-btn"
                              title={t('patientRecord.treatment.edit') ?? ''}
                              onClick={() => {
                                setEditingTreatment(tr);
                                setEditError(null);
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title={t('patientRecord.treatment.delete') ?? ''}
                              onClick={() => {
                                setDeletingRow(row);
                                setDeleteError(null);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
          {deleteError && <div className="form-error-banner">{deleteError}</div>}
          {statusError && <div className="form-error-banner">{statusError}</div>}
        </div>
      </SectionCard>

      {editingTreatment && (
        <TreatmentEditModal
          treatment={editingTreatment}
          treatmentTypes={treatmentTypes}
          error={editError}
          pending={updateMutation.isPending}
          onClose={() => setEditingTreatment(null)}
          onSave={(payload) => updateMutation.mutate({ id: editingTreatment.id, payload })}
        />
      )}

      {showTreatmentPlan && <TreatmentPlanModal patient={patient} onClose={() => setShowTreatmentPlan(false)} />}

      {deletingRow && (
        <Modal
          title={
            isPartialToothRemoval(deletingRow)
              ? t('patientRecord.treatment.removeToothConfirmTitle')
              : t('patientRecord.treatment.deleteConfirmTitle')
          }
          icon={<Trash2 size={16} />}
          onClose={() => {
            if (!deletePending) setDeletingRow(null);
          }}
        >
          <p>
            {isPartialToothRemoval(deletingRow)
              ? t('patientRecord.treatment.removeToothConfirm', { tooth: deletingRow.tooth })
              : t('patientRecord.treatment.deleteConfirm')}
          </p>
          {deleteError && <div className="form-error-banner">{deleteError}</div>}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDeletingRow(null)}
              disabled={deletePending}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={handleConfirmDelete}
              disabled={deletePending}
            >
              {isPartialToothRemoval(deletingRow)
                ? t('patientRecord.treatment.removeToothAction')
                : t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function TreatmentEditModal({
  treatment,
  treatmentTypes,
  error,
  pending,
  onClose,
  onSave,
}: {
  treatment: PatientTreatment;
  treatmentTypes: import('@/types/domain').TreatmentType[];
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (payload: UpdateTreatmentPayload) => void;
}) {
  const { t } = useTranslation();
  const [treatmentTypeId, setTreatmentTypeId] = useState(treatment.treatmentTypeId);
  const [treatmentScope, setTreatmentScope] = useState<TreatmentScope>(
    treatment.treatmentScope ?? 'SINGLE',
  );
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>(
    treatment.teeth.length > 0 ? treatment.teeth : treatment.toothNumber ? [treatment.toothNumber] : [],
  );
  const [treatmentDate, setTreatmentDate] = useState(treatment.treatmentDate ?? treatment.createdAt.slice(0, 10));
  const [discount, setDiscount] = useState(String(centsToAmount(treatment.discountCents)));
  const [status, setStatus] = useState<TreatmentStatus>(treatment.status);
  const [note, setNote] = useState(treatment.note ?? '');

  const selectedType = treatmentTypes.find((type) => type.id === treatmentTypeId) ?? null;
  const effectiveScope = resolveScope(treatmentScope, selectedType?.scope ?? null);
  const effectiveTeeth =
    effectiveScope === 'SINGLE' ? selectedTeeth : teethForScope(effectiveScope);

  useEffect(() => {
    if (isJawScope(effectiveScope)) {
      setSelectedTeeth(teethForScope(effectiveScope));
    }
  }, [effectiveScope]);

  function handleScopeChange(scope: TreatmentScope) {
    setTreatmentScope(scope);
    if (scope !== 'SINGLE') {
      setSelectedTeeth(teethForScope(scope));
    }
  }

  function handleSubmit() {
    if (effectiveScope === 'SINGLE' && selectedTeeth.length === 0) return;
    onSave({
      treatmentTypeId,
      teeth: effectiveTeeth,
      treatmentDate,
      treatmentScope: effectiveScope,
      discount: Number(discount) || 0,
      status,
      note: note.trim() || undefined,
    });
  }

  return (
    <Modal title={t('patientRecord.treatment.editTitle')} icon={<Pencil size={16} />} onClose={onClose} size="wide">
      <div className="inline-form">
        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.treatmentDate')}</span>
          <input type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.columns.treatment')}</span>
          <select value={treatmentTypeId} onChange={(e) => setTreatmentTypeId(Number(e.target.value))}>
            {treatmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {t(`patientRecord.treatmentTypes.${type.code}`, { defaultValue: type.label })}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.scope')}</span>
          <select value={treatmentScope} onChange={(e) => handleScopeChange(e.target.value as TreatmentScope)}>
            {SCOPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`patientRecord.treatment.scopes.${s}`)}
              </option>
            ))}
          </select>
        </label>

        {effectiveScope === 'SINGLE' ? (
          <label className="form-field">
            <span className="form-field__label">{t('patientRecord.treatment.columns.teeth')}</span>
            <input
              value={selectedTeeth.join(', ')}
              onChange={(e) => {
                const nums = e.target.value
                  .split(/[,\s]+/)
                  .map((x) => Number(x.trim()))
                  .filter((n) => Number.isInteger(n) && n > 0);
                setSelectedTeeth(nums);
              }}
              placeholder="11, 12, 21"
            />
          </label>
        ) : (
          <p className="muted">
            {t('patientRecord.treatment.selectedTeeth')}: {[...effectiveTeeth].sort((a, b) => a - b).join(', ')}
          </p>
        )}

        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.discount')}</span>
          <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as TreatmentStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`patientRecord.treatmentStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('patientRecord.treatment.note')}</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <div className="form-error-banner">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={pending}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
