import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { treatmentsApi } from '@/api/treatments.api';
import { TREATMENT_CATEGORY_ORDER, TreatmentCategory } from '@/constants/treatmentCategories';
import { getErrorMessage } from '@/utils/errors';
import { centsToAmount, formatMoney } from '@/utils/money';
import { TreatmentType } from '@/types/domain';

function parseOptionalDays(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return n > 0 ? Math.round(n) : null;
}

function parseOptionalPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return n >= 0 ? n : null;
}

function formatFollowUpCell(type: TreatmentType, t: (key: string, opts?: Record<string, unknown>) => string) {
  const days = [type.followUp1Days, type.followUp2Days, type.followUp3Days].filter(
    (d): d is number => d != null && d > 0,
  );
  if (days.length === 0) {
    const legacy = type.followUpDays;
    if (legacy && legacy > 0) {
      return t('settings.treatmentCatalog.followUpDaysValue', { count: legacy });
    }
    return t('settings.treatmentCatalog.followUpNone');
  }
  return days.map((d) => t('settings.treatmentCatalog.followUpDaysValue', { count: d })).join(' · ');
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('settings.treatmentCatalog.categoryNone')}</option>
      {TREATMENT_CATEGORY_ORDER.map((cat) => (
        <option key={cat} value={cat}>
          {t(`settings.treatmentCatalog.categories.${cat}`)}
        </option>
      ))}
    </select>
  );
}

function FollowUpInputs({
  values,
  onChange,
}: {
  values: [string, string, string];
  onChange: (index: 0 | 1 | 2, value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="catalog-followups">
      {[0, 1, 2].map((i) => (
        <label key={i} className="catalog-followups__item">
          <span className="muted">{t(`settings.treatmentCatalog.followUp${i + 1}`)}</span>
          <input
            type="number"
            min={1}
            className="catalog-followup-input"
            value={values[i]}
            onChange={(e) => onChange(i as 0 | 1 | 2, e.target.value)}
            placeholder="—"
          />
        </label>
      ))}
    </div>
  );
}

export function TreatmentCatalogSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: types = [] } = useQuery({
    queryKey: ['treatment-catalog'],
    queryFn: () => treatmentsApi.listCatalog(),
  });

  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAbbreviation, setEditAbbreviation] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editReferencePrice, setEditReferencePrice] = useState('');
  const [editFollowUps, setEditFollowUps] = useState<[string, string, string]>(['', '', '']);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [category, setCategory] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [referencePrice, setReferencePrice] = useState('');
  const [followUps, setFollowUps] = useState<[string, string, string]>(['', '', '']);
  const [error, setError] = useState<string | null>(null);

  const displayedTypes = useMemo(() => {
    let list = [...types];
    if (categoryFilter) {
      list = list.filter((row) => row.category === categoryFilter);
    }
    list.sort((a, b) => {
      const ai = a.category ? TREATMENT_CATEGORY_ORDER.indexOf(a.category as TreatmentCategory) : 999;
      const bi = b.category ? TREATMENT_CATEGORY_ORDER.indexOf(b.category as TreatmentCategory) : 999;
      if (ai !== bi) return ai - bi;
      return a.sortOrder - b.sortOrder;
    });
    return list;
  }, [types, categoryFilter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['treatment-catalog'] });

  const createMutation = useMutation({
    mutationFn: treatmentsApi.createType,
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['treatment-types'] });
      resetAddForm();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof treatmentsApi.updateType>[1] }) =>
      treatmentsApi.updateType(id, payload),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['treatment-types'] });
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function resetAddForm() {
    setAdding(false);
    setLabel('');
    setAbbreviation('');
    setCategory('');
    setDefaultPrice('');
    setReferencePrice('');
    setFollowUps(['', '', '']);
    setError(null);
  }

  function followUpPayload(values: [string, string, string]) {
    return {
      followUp1Days: parseOptionalDays(values[0]),
      followUp2Days: parseOptionalDays(values[1]),
      followUp3Days: parseOptionalDays(values[2]),
    };
  }

  function startEdit(type: TreatmentType) {
    setEditingId(type.id);
    setEditLabel(type.label);
    setEditAbbreviation(type.abbreviation);
    setEditCategory(type.category ?? '');
    setEditPrice(centsToAmount(type.defaultPriceCents).toFixed(2));
    setEditReferencePrice(
      type.referencePriceCents != null ? centsToAmount(type.referencePriceCents).toFixed(2) : '',
    );
    setEditFollowUps([
      type.followUp1Days ? String(type.followUp1Days) : type.followUpDays ? String(type.followUpDays) : '',
      type.followUp2Days ? String(type.followUp2Days) : '',
      type.followUp3Days ? String(type.followUp3Days) : '',
    ]);
    setError(null);
  }

  function saveEdit(id: number) {
    updateMutation.mutate({
      id,
      payload: {
        label: editLabel.trim(),
        abbreviation: editAbbreviation.trim(),
        category: editCategory || null,
        defaultPrice: Number(editPrice) || 0,
        referencePrice: parseOptionalPrice(editReferencePrice),
        ...followUpPayload(editFollowUps),
      },
    });
  }

  function toggleActive(type: TreatmentType) {
    updateMutation.mutate({ id: type.id, payload: { isActive: !type.isActive } });
  }

  function handleCreate() {
    setError(null);
    if (!label.trim() || !abbreviation.trim()) {
      setError(t('settings.treatmentCatalog.validation.required'));
      return;
    }
    createMutation.mutate({
      label: label.trim(),
      abbreviation: abbreviation.trim(),
      category: category || undefined,
      defaultPrice: Number(defaultPrice) || 0,
      referencePrice: parseOptionalPrice(referencePrice),
      ...followUpPayload(followUps),
    });
  }

  function categoryLabel(cat: string | null) {
    if (!cat) return '—';
    return t(`settings.treatmentCatalog.categories.${cat}`, { defaultValue: cat });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.treatmentCatalog.title')}</h2>
      <p className="muted">{t('settings.treatmentCatalog.catalogHint')}</p>

      <div className="catalog-filter-bar">
        <label className="form-field catalog-filter-bar__field">
          <span className="form-field__label">{t('settings.treatmentCatalog.filterCategory')}</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t('settings.treatmentCatalog.filterAll')}</option>
            {TREATMENT_CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {t(`settings.treatmentCatalog.categories.${cat}`)}
              </option>
            ))}
          </select>
        </label>
        <span className="muted catalog-filter-bar__count">
          {t('settings.treatmentCatalog.showingCount', { count: displayedTypes.length, total: types.length })}
        </span>
      </div>

      <div className="catalog-table-wrap">
        <table className="patients-table">
          <thead>
            <tr>
              <th>{t('settings.treatmentCatalog.category')}</th>
              <th>{t('settings.treatmentCatalog.name')}</th>
              <th>{t('settings.treatmentCatalog.code')}</th>
              <th>{t('settings.treatmentCatalog.price')}</th>
              <th>{t('settings.treatmentCatalog.referencePrice')}</th>
              <th>{t('settings.treatmentCatalog.followUpAfter')}</th>
              <th>{t('settings.treatmentCatalog.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {displayedTypes.map((type) =>
              editingId === type.id ? (
                <tr key={type.id}>
                  <td>
                    <CategorySelect value={editCategory} onChange={setEditCategory} />
                  </td>
                  <td>
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  </td>
                  <td>
                    <input
                      className="catalog-code-input"
                      value={editAbbreviation}
                      onChange={(e) => setEditAbbreviation(e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="catalog-price-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="catalog-price-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editReferencePrice}
                      onChange={(e) => setEditReferencePrice(e.target.value)}
                      placeholder="—"
                    />
                  </td>
                  <td>
                    <FollowUpInputs
                      values={editFollowUps}
                      onChange={(index, value) =>
                        setEditFollowUps((prev) => {
                          const next: [string, string, string] = [...prev];
                          next[index] = value;
                          return next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <span className={type.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                      {type.isActive ? t('settings.treatmentCatalog.active') : t('settings.treatmentCatalog.inactive')}
                    </span>
                  </td>
                  <td className="catalog-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => saveEdit(type.id)}
                      disabled={updateMutation.isPending}
                    >
                      {t('common.save')}
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>
                      {t('common.cancel')}
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={type.id} className={!type.isActive ? 'catalog-row--inactive' : undefined}>
                  <td>{categoryLabel(type.category)}</td>
                  <td>
                    <span className="treatment-type-card__dot" style={{ backgroundColor: type.colorHex }} />{' '}
                    {t(`patientRecord.treatmentTypes.${type.code}`, { defaultValue: type.label })}
                  </td>
                  <td>{type.abbreviation}</td>
                  <td>{formatMoney(type.defaultPriceCents)}</td>
                  <td>
                    {type.referencePriceCents != null ? (
                      formatMoney(type.referencePriceCents)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{formatFollowUpCell(type, t)}</td>
                  <td>
                    <span className={type.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                      {type.isActive ? t('settings.treatmentCatalog.active') : t('settings.treatmentCatalog.inactive')}
                    </span>
                  </td>
                  <td className="catalog-actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(type)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(type)}>
                      {type.isActive
                        ? t('settings.treatmentCatalog.disable')
                        : t('settings.treatmentCatalog.enable')}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <h3>{t('settings.treatmentCatalog.addTitle')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.treatmentCatalog.category')}</span>
              <CategorySelect value={category} onChange={setCategory} />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.treatmentCatalog.name')}</span>
              <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label className="form-field inline-form__col inline-form__col--small">
              <span className="form-field__label">{t('settings.treatmentCatalog.code')}</span>
              <input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
            </label>
            <label className="form-field inline-form__col inline-form__col--small">
              <span className="form-field__label">{t('settings.treatmentCatalog.price')}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
              />
            </label>
            <label className="form-field inline-form__col inline-form__col--small">
              <span className="form-field__label">{t('settings.treatmentCatalog.referencePrice')}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={referencePrice}
                onChange={(e) => setReferencePrice(e.target.value)}
                placeholder="—"
              />
            </label>
          </div>
          <FollowUpInputs
            values={followUps}
            onChange={(index, value) =>
              setFollowUps((prev) => {
                const next: [string, string, string] = [...prev];
                next[index] = value;
                return next;
              })
            }
          />
          {error && <div className="form-error-banner">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={resetAddForm}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="form-actions form-actions--start">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setAdding(true)}>
            {t('settings.treatmentCatalog.addTitle')}
          </button>
        </div>
      )}
    </section>
  );
}
