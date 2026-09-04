import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { areasApi } from '@/api/settings.api';
import { getErrorMessage } from '@/utils/errors';
import { Area } from '@/types/domain';

export function AreasSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: areas = [] } = useQuery({
    queryKey: ['areas-catalog'],
    queryFn: () => areasApi.listAll(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['areas-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['areas'] });
  };

  const createMutation = useMutation({
    mutationFn: areasApi.create,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setName('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof areasApi.update>[1] }) =>
      areasApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const removeMutation = useMutation({
    mutationFn: areasApi.remove,
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(area: Area) {
    setEditingId(area.id);
    setEditName(area.name);
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editName.trim()) {
      setError(t('settings.areas.validation.required'));
      return;
    }
    updateMutation.mutate({ id, payload: { name: editName.trim() } });
  }

  function toggleActive(area: Area) {
    updateMutation.mutate({ id: area.id, payload: { isActive: !area.isActive } });
  }

  function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError(t('settings.areas.validation.required'));
      return;
    }
    createMutation.mutate({ name: name.trim() });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.areas.title')}</h2>
      <p className="muted">{t('settings.areas.hint')}</p>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.areas.name')}</th>
            <th>{t('settings.areas.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) =>
            editingId === area.id ? (
              <tr key={area.id}>
                <td>
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                </td>
                <td>
                  <span className={area.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {area.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => saveEdit(area.id)}
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
              <tr key={area.id} className={!area.isActive ? 'catalog-row--inactive' : undefined}>
                <td>{area.name}</td>
                <td>
                  <span className={area.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {area.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(area)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(area)}>
                    {area.isActive ? t('common.disable') : t('common.enable')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small btn--danger"
                    onClick={() => removeMutation.mutate(area.id)}
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
          <h3>{t('settings.areas.addTitle')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.areas.name')}</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.areas.namePlaceholder') ?? ''}
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
            {t('settings.areas.addTitle')}
          </button>
        </div>
      )}

      {error && !adding && editingId === null && <div className="form-error-banner">{error}</div>}
    </section>
  );
}
