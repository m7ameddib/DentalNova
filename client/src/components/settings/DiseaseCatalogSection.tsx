import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diseaseCatalogApi } from '@/api/settings.api';
import { getErrorMessage } from '@/utils/errors';
import { DiseaseCatalogItem } from '@/types/domain';

export function DiseaseCatalogSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: diseases = [] } = useQuery({
    queryKey: ['disease-catalog-all'],
    queryFn: () => diseaseCatalogApi.listAll(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['disease-catalog-all'] });
    queryClient.invalidateQueries({ queryKey: ['disease-catalog'] });
  };

  const createMutation = useMutation({
    mutationFn: diseaseCatalogApi.create,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setName('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof diseaseCatalogApi.update>[1] }) =>
      diseaseCatalogApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const removeMutation = useMutation({
    mutationFn: diseaseCatalogApi.remove,
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(item: DiseaseCatalogItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editName.trim()) {
      setError(t('settings.diseases.validation.required'));
      return;
    }
    updateMutation.mutate({ id, payload: { name: editName.trim() } });
  }

  function toggleActive(item: DiseaseCatalogItem) {
    updateMutation.mutate({ id: item.id, payload: { isActive: !item.isActive } });
  }

  function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError(t('settings.diseases.validation.required'));
      return;
    }
    createMutation.mutate({ name: name.trim() });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.diseases.title')}</h2>
      <p className="muted">{t('settings.diseases.hint')}</p>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.diseases.name')}</th>
            <th>{t('settings.diseases.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {diseases.map((item) =>
            editingId === item.id ? (
              <tr key={item.id}>
                <td>
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                </td>
                <td>
                  <span className={item.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {item.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => saveEdit(item.id)}
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
              <tr key={item.id} className={!item.isActive ? 'catalog-row--inactive' : undefined}>
                <td>{item.name}</td>
                <td>
                  <span className={item.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {item.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(item)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(item)}>
                    {item.isActive ? t('common.disable') : t('common.enable')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small btn--danger"
                    onClick={() => removeMutation.mutate(item.id)}
                    disabled={removeMutation.isPending}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <h3>{t('settings.diseases.addTitle')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.diseases.name')}</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.diseases.namePlaceholder') ?? ''}
              />
            </label>
          </div>
          {error && <div className="form-error-banner">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
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
            {t('settings.diseases.addTitle')}
          </button>
        </div>
      )}

      {error && !adding && editingId === null && <div className="form-error-banner">{error}</div>}
    </section>
  );
}
