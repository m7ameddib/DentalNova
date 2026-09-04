import { Fragment, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { guarantorsApi } from '@/api/guarantors.api';
import { treatmentsApi } from '@/api/treatments.api';
import { getErrorMessage } from '@/utils/errors';
import { centsToAmount, formatMoney } from '@/utils/money';
import { Guarantor } from '@/types/domain';

export function GuarantorsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: guarantors = [] } = useQuery({
    queryKey: ['guarantors-catalog'],
    queryFn: () => guarantorsApi.list(),
  });

  const { data: treatmentTypes = [] } = useQuery({
    queryKey: ['treatment-types'],
    queryFn: () => treatmentsApi.listTypes(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['guarantors-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['guarantors'] });
  };

  const createMutation = useMutation({
    mutationFn: (n: string) => guarantorsApi.create(n),
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setName('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; isActive?: boolean } }) =>
      guarantorsApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const upsertPriceMutation = useMutation({
    mutationFn: ({
      guarantorId,
      treatmentTypeId,
      price,
    }: {
      guarantorId: number;
      treatmentTypeId: number;
      price: number;
    }) => guarantorsApi.upsertPrice(guarantorId, treatmentTypeId, price),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['guarantor-prices', vars.guarantorId] });
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(g: Guarantor) {
    setEditingId(g.id);
    setEditName(g.name);
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editName.trim()) {
      setError(t('settings.guarantors.validation.required'));
      return;
    }
    updateMutation.mutate({ id, payload: { name: editName.trim() } });
  }

  function toggleActive(g: Guarantor) {
    updateMutation.mutate({ id: g.id, payload: { isActive: !g.isActive } });
  }

  function handleCreate() {
    if (!name.trim()) {
      setError(t('settings.guarantors.validation.required'));
      return;
    }
    createMutation.mutate(name.trim());
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.guarantors.title')}</h2>
      <p className="muted">{t('settings.guarantors.hint')}</p>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.guarantors.name')}</th>
            <th>{t('settings.guarantors.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {guarantors.map((g) => (
            <Fragment key={g.id}>
              <tr key={g.id} className={!g.isActive ? 'catalog-row--inactive' : undefined}>
                <td>
                  {editingId === g.id ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <button type="button" className="link-btn" onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
                      {expandedId === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {g.name}
                    </button>
                  )}
                </td>
                <td>
                  <span className={g.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {g.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  {editingId === g.id ? (
                    <>
                      <button type="button" className="btn btn--primary btn--small" onClick={() => saveEdit(g.id)}>
                        {t('common.save')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(g)}>
                        {t('common.edit')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(g)}>
                        {g.isActive ? t('common.disable') : t('common.enable')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
              {expandedId === g.id && (
                <tr key={`${g.id}-prices`}>
                  <td colSpan={3}>
                    <GuarantorPricesPanel
                      guarantorId={g.id}
                      treatmentTypes={treatmentTypes}
                      priceEdits={priceEdits}
                      setPriceEdits={setPriceEdits}
                      onSavePrice={(treatmentTypeId, price) =>
                        upsertPriceMutation.mutate({ guarantorId: g.id, treatmentTypeId, price })
                      }
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <label className="form-field">
            <span className="form-field__label">{t('settings.guarantors.name')}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
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
            {t('settings.guarantors.addTitle')}
          </button>
        </div>
      )}

      {error && !adding && editingId === null && <div className="form-error-banner">{error}</div>}
    </section>
  );
}

function GuarantorPricesPanel({
  guarantorId,
  treatmentTypes,
  priceEdits,
  setPriceEdits,
  onSavePrice,
}: {
  guarantorId: number;
  treatmentTypes: import('@/types/domain').TreatmentType[];
  priceEdits: Record<number, string>;
  setPriceEdits: Dispatch<SetStateAction<Record<number, string>>>;
  onSavePrice: (treatmentTypeId: number, price: number) => void;
}) {
  const { t } = useTranslation();
  const { data: prices = [] } = useQuery({
    queryKey: ['guarantor-prices', guarantorId],
    queryFn: () => guarantorsApi.listPrices(guarantorId),
  });

  const priceMap = new Map(prices.map((p) => [p.treatmentTypeId, p.priceCents]));

  return (
    <div className="guarantor-prices-panel">
      <p className="muted">{t('settings.guarantors.pricesHint')}</p>
      <table className="patients-table patients-table--compact">
        <thead>
          <tr>
            <th>{t('settings.treatmentCatalog.name')}</th>
            <th>{t('settings.guarantors.defaultPrice')}</th>
            <th>{t('settings.guarantors.guarantorPrice')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {treatmentTypes.filter((tt) => tt.isActive).map((tt) => {
            const existing = priceMap.get(tt.id);
            const editVal = priceEdits[tt.id] ?? (existing != null ? String(centsToAmount(existing)) : '');
            return (
              <tr key={tt.id}>
                <td>{tt.label}</td>
                <td>{formatMoney(tt.defaultPriceCents)}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editVal}
                    onChange={(e) => setPriceEdits((prev) => ({ ...prev, [tt.id]: e.target.value }))}
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      const price = Number(editVal);
                      if (price >= 0) onSavePrice(tt.id, price);
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
