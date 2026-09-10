import { Fragment, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { labCasesApi } from '@/api/lab-cases.api';
import { getErrorMessage } from '@/utils/errors';
import { centsToAmount } from '@/utils/money';
import { LabName } from '@/types/domain';

export function LaboratoriesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: labNames = [] } = useQuery({
    queryKey: ['lab-names-catalog'],
    queryFn: () => labCasesApi.labNames(),
  });

  const { data: workTypes = [] } = useQuery({
    queryKey: ['lab-work-types'],
    queryFn: () => labCasesApi.workTypes(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [costEdits, setCostEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-names-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['lab-names'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; phone: string }) => labCasesApi.createLabName(payload),
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setName('');
      setPhone('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { name?: string; phone?: string | null; isActive?: boolean };
    }) => labCasesApi.updateLabName(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const upsertCostMutation = useMutation({
    mutationFn: ({ labId, workTypeCode, cost }: { labId: number; workTypeCode: string; cost: number }) =>
      labCasesApi.upsertServiceCost(labId, workTypeCode, cost),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lab-service-costs', vars.labId] });
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => labCasesApi.deleteLabName(id),
    onSuccess: () => invalidate(),
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(lab: LabName) {
    setEditingId(lab.id);
    setEditName(lab.name);
    setEditPhone(lab.phone ?? '');
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editName.trim()) {
      setError(t('settings.laboratories.validation.required'));
      return;
    }
    if (!editPhone.trim()) {
      setError(t('settings.laboratories.validation.phoneRequired'));
      return;
    }
    updateMutation.mutate({ id, payload: { name: editName.trim(), phone: editPhone.trim() } });
  }

  function toggleActive(lab: LabName) {
    updateMutation.mutate({ id: lab.id, payload: { isActive: !lab.isActive } });
  }

  function handleCreate() {
    if (!name.trim()) {
      setError(t('settings.laboratories.validation.required'));
      return;
    }
    if (!phone.trim()) {
      setError(t('settings.laboratories.validation.phoneRequired'));
      return;
    }
    createMutation.mutate({ name: name.trim(), phone: phone.trim() });
  }

  function handleDelete(lab: LabName) {
    if (!window.confirm(t('settings.laboratories.deleteConfirm', { name: lab.name }))) return;
    deleteMutation.mutate(lab.id);
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.laboratories.title')}</h2>
      <p className="muted">{t('settings.laboratories.hint')}</p>

      <div className="catalog-table-wrap">
        <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.laboratories.name')}</th>
            <th>{t('settings.laboratories.phone')}</th>
            <th>{t('settings.laboratories.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {labNames.map((lab) => (
            <Fragment key={lab.id}>
              <tr key={lab.id} className={!lab.isActive ? 'catalog-row--inactive' : undefined}>
                <td>
                  {editingId === lab.id ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setExpandedId(expandedId === lab.id ? null : lab.id)}
                    >
                      {expandedId === lab.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {lab.name}
                    </button>
                  )}
                </td>
                <td>
                  {editingId === lab.id ? (
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  ) : (
                    lab.phone || '—'
                  )}
                </td>
                <td>
                  <span className={lab.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {lab.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  {editingId === lab.id ? (
                    <>
                      <button type="button" className="btn btn--primary btn--small" onClick={() => saveEdit(lab.id)}>
                        {t('common.save')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(lab)}>
                        {t('common.edit')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(lab)}>
                        {lab.isActive ? t('common.disable') : t('common.enable')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => handleDelete(lab)}
                        disabled={deleteMutation.isPending}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
              {expandedId === lab.id && (
                <tr key={`${lab.id}-costs`}>
                  <td colSpan={4}>
                    <LabServiceCostsPanel
                      labId={lab.id}
                      workTypes={workTypes}
                      costEdits={costEdits}
                      setCostEdits={setCostEdits}
                      onSaveCost={(workTypeCode, cost) =>
                        upsertCostMutation.mutate({ labId: lab.id, workTypeCode, cost })
                      }
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        </table>
      </div>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <label className="form-field">
            <span className="form-field__label">{t('settings.laboratories.name')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('settings.laboratories.phone')}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          {error && <div className="form-error-banner">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={handleCreate} disabled={createMutation.isPending}>
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="form-actions form-actions--start">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setAdding(true)}>
            {t('settings.laboratories.addTitle')}
          </button>
        </div>
      )}

      {error && !adding && editingId === null && <div className="form-error-banner">{error}</div>}
    </section>
  );
}

function LabServiceCostsPanel({
  labId,
  workTypes,
  costEdits,
  setCostEdits,
  onSaveCost,
}: {
  labId: number;
  workTypes: import('@/types/domain').LabWorkType[];
  costEdits: Record<string, string>;
  setCostEdits: Dispatch<SetStateAction<Record<string, string>>>;
  onSaveCost: (workTypeCode: string, cost: number) => void;
}) {
  const { t } = useTranslation();
  const { data: costs = [] } = useQuery({
    queryKey: ['lab-service-costs', labId],
    queryFn: () => labCasesApi.listServiceCosts(labId),
  });

  const costMap = new Map(costs.map((c) => [c.workTypeCode, c.costCents]));

  return (
    <div className="guarantor-prices-panel">
      <p className="muted">{t('settings.laboratories.costsHint')}</p>
      <table className="patients-table patients-table--compact">
        <thead>
          <tr>
            <th>{t('settings.laboratories.workType')}</th>
            <th>{t('settings.laboratories.serviceCost')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {workTypes.filter((wt) => wt.isActive).map((wt) => {
            const existing = costMap.get(wt.code);
            const editVal = costEdits[`${labId}-${wt.code}`] ?? (existing != null ? String(centsToAmount(existing)) : '');
            return (
              <tr key={wt.code}>
                <td>{wt.label}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editVal}
                    onChange={(e) =>
                      setCostEdits((prev) => ({ ...prev, [`${labId}-${wt.code}`]: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      const cost = Number(editVal);
                      if (cost >= 0) onSaveCost(wt.code, cost);
                    }}
                  >
                    {t('common.save')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
