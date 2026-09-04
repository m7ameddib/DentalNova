import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentMethodsApi } from '@/api/settings.api';
import { getErrorMessage } from '@/utils/errors';
import { PaymentMethodEntity } from '@/types/domain';

export function PaymentMethodsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods-catalog'],
    queryFn: () => paymentMethodsApi.listAll(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payment-methods-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  };

  const createMutation = useMutation({
    mutationFn: paymentMethodsApi.create,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setLabel('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof paymentMethodsApi.update>[1] }) =>
      paymentMethodsApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(method: PaymentMethodEntity) {
    setEditingId(method.id);
    setEditLabel(method.label);
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editLabel.trim()) {
      setError(t('settings.paymentMethods.validation.required'));
      return;
    }
    updateMutation.mutate({ id, payload: { label: editLabel.trim() } });
  }

  function toggleActive(method: PaymentMethodEntity) {
    updateMutation.mutate({ id: method.id, payload: { isActive: !method.isActive } });
  }

  function handleCreate() {
    setError(null);
    if (!label.trim()) {
      setError(t('settings.paymentMethods.validation.required'));
      return;
    }
    createMutation.mutate({ label: label.trim() });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.paymentMethods.title')}</h2>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.paymentMethods.name')}</th>
            <th>{t('settings.paymentMethods.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((method) =>
            editingId === method.id ? (
              <tr key={method.id}>
                <td>
                  <input autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                </td>
                <td>
                  <span className={method.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {method.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => saveEdit(method.id)}
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
              <tr key={method.id} className={!method.isActive ? 'catalog-row--inactive' : undefined}>
                <td>{method.code === 'CASH' ? t('patientRecord.paymentMethod.CASH') : method.label}</td>
                <td>
                  <span className={method.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {method.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(method)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(method)}>
                    {method.isActive ? t('common.disable') : t('common.enable')}
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <h3>{t('settings.paymentMethods.addTitle')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.paymentMethods.name')}</span>
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('settings.paymentMethods.namePlaceholder') ?? ''}
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
            {t('settings.paymentMethods.addTitle')}
          </button>
        </div>
      )}
    </section>
  );
}
