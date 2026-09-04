import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseCategoriesApi } from '@/api/expense-categories.api';
import { getErrorMessage } from '@/utils/errors';
import { ExpenseCategoryEntity } from '@/types/domain';

export function ExpenseCategoriesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories-catalog'],
    queryFn: () => expenseCategoriesApi.listCatalog(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense-categories-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: expenseCategoriesApi.create,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setLabel('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { label?: string; isActive?: boolean } }) =>
      expenseCategoriesApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(cat: ExpenseCategoryEntity) {
    setEditingId(cat.id);
    setEditLabel(cat.label);
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editLabel.trim()) {
      setError(t('settings.expenseCategories.validation.required'));
      return;
    }
    updateMutation.mutate({ id, payload: { label: editLabel.trim() } });
  }

  function toggleActive(cat: ExpenseCategoryEntity) {
    if (cat.isSystem) return;
    updateMutation.mutate({ id: cat.id, payload: { isActive: !cat.isActive } });
  }

  function handleCreate() {
    if (!label.trim()) {
      setError(t('settings.expenseCategories.validation.required'));
      return;
    }
    createMutation.mutate(label.trim());
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.expenseCategories.title')}</h2>
      <p className="muted">{t('settings.expenseCategories.hint')}</p>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.expenseCategories.name')}</th>
            <th>{t('settings.expenseCategories.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) =>
            editingId === cat.id ? (
              <tr key={cat.id}>
                <td>
                  <input autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                </td>
                <td>
                  <span className={cat.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {cat.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--primary btn--small" onClick={() => saveEdit(cat.id)}>
                    {t('common.save')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={cat.id} className={!cat.isActive ? 'catalog-row--inactive' : undefined}>
                <td>
                  {cat.label}
                  {cat.isSystem && <span className="muted"> ({t('settings.expenseCategories.system')})</span>}
                </td>
                <td>
                  <span className={cat.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {cat.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(cat)}>
                    {t('common.edit')}
                  </button>
                  {!cat.isSystem && (
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(cat)}>
                      {cat.isActive ? t('common.disable') : t('common.enable')}
                    </button>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <label className="form-field">
            <span className="form-field__label">{t('settings.expenseCategories.name')}</span>
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
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
            {t('settings.expenseCategories.addTitle')}
          </button>
        </div>
      )}

      {error && !adding && editingId === null && <div className="form-error-banner">{error}</div>}
    </section>
  );
}
