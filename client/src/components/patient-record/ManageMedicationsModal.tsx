import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pill, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { medicationCatalogApi } from '@/api/medication-catalog.api';
import { getErrorMessage } from '@/utils/errors';
import { MedicationCatalogItem, MedicationCategory } from '@/types/domain';

const CATEGORIES: MedicationCategory[] = ['ANTIBIOTICS', 'PAINKILLERS', 'ANTI_INFLAMMATORY', 'MOUTHWASH', 'OTHER'];

interface FormState {
  name: string;
  strengthForm: string;
  category: MedicationCategory;
  defaultDose: string;
  defaultFrequency: string;
  defaultDuration: string;
  defaultInstructions: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  strengthForm: '',
  category: 'OTHER',
  defaultDose: '',
  defaultFrequency: '',
  defaultDuration: '',
  defaultInstructions: '',
};

export function ManageMedicationsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: catalog = [] } = useQuery({
    queryKey: ['medication-catalog'],
    queryFn: () => medicationCatalogApi.list(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['medication-catalog'] });

  const createMutation = useMutation({
    mutationFn: medicationCatalogApi.create,
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setAddForm(EMPTY_FORM);
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof medicationCatalogApi.update>[1] }) =>
      medicationCatalogApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => medicationCatalogApi.remove(id),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(item: MedicationCatalogItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      strengthForm: item.strengthForm ?? '',
      category: (item.category as MedicationCategory) ?? 'OTHER',
      defaultDose: item.defaultDose ?? '',
      defaultFrequency: item.defaultFrequency ?? '',
      defaultDuration: item.defaultDuration ?? '',
      defaultInstructions: item.defaultInstructions ?? '',
    });
    setError(null);
  }

  function saveEdit(id: number) {
    if (!editForm.name.trim()) {
      setError(t('medicationCatalog.validation.required'));
      return;
    }
    updateMutation.mutate({
      id,
      payload: {
        name: editForm.name.trim(),
        strengthForm: editForm.strengthForm.trim(),
        category: editForm.category,
        defaultDose: editForm.defaultDose.trim(),
        defaultFrequency: editForm.defaultFrequency.trim(),
        defaultDuration: editForm.defaultDuration.trim(),
        defaultInstructions: editForm.defaultInstructions.trim(),
      },
    });
  }

  function toggleActive(item: MedicationCatalogItem) {
    updateMutation.mutate({ id: item.id, payload: { isActive: !item.isActive } });
  }

  function handleCreate() {
    setError(null);
    if (!addForm.name.trim()) {
      setError(t('medicationCatalog.validation.required'));
      return;
    }
    createMutation.mutate({
      name: addForm.name.trim(),
      strengthForm: addForm.strengthForm.trim(),
      category: addForm.category,
      defaultDose: addForm.defaultDose.trim(),
      defaultFrequency: addForm.defaultFrequency.trim(),
      defaultDuration: addForm.defaultDuration.trim(),
      defaultInstructions: addForm.defaultInstructions.trim(),
    });
  }

  return (
    <Modal title={t('medicationCatalog.title')} icon={<Pill size={16} />} onClose={onClose} size="xwide">
      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('medicationCatalog.name')}</th>
            <th>{t('medicationCatalog.strengthForm')}</th>
            <th>{t('medicationCatalog.category')}</th>
            <th>{t('medicationCatalog.defaultDose')}</th>
            <th>{t('medicationCatalog.defaultFrequency')}</th>
            <th>{t('medicationCatalog.defaultDuration')}</th>
            <th>{t('medicationCatalog.defaultInstructions')}</th>
            <th>{t('settings.treatmentCatalog.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((item) =>
            editingId === item.id ? (
              <tr key={item.id}>
                <td>
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </td>
                <td>
                  <input
                    value={editForm.strengthForm}
                    onChange={(e) => setEditForm((f) => ({ ...f, strengthForm: e.target.value }))}
                  />
                </td>
                <td>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as MedicationCategory }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`prescriptionBuilder.categories.${c}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={editForm.defaultDose}
                    onChange={(e) => setEditForm((f) => ({ ...f, defaultDose: e.target.value }))}
                  />
                </td>
                <td>
                  <input
                    value={editForm.defaultFrequency}
                    onChange={(e) => setEditForm((f) => ({ ...f, defaultFrequency: e.target.value }))}
                  />
                </td>
                <td>
                  <input
                    value={editForm.defaultDuration}
                    onChange={(e) => setEditForm((f) => ({ ...f, defaultDuration: e.target.value }))}
                  />
                </td>
                <td>
                  <input
                    value={editForm.defaultInstructions}
                    onChange={(e) => setEditForm((f) => ({ ...f, defaultInstructions: e.target.value }))}
                  />
                </td>
                <td>
                  <span className={item.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {item.isActive ? t('settings.treatmentCatalog.active') : t('settings.treatmentCatalog.inactive')}
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
                <td>{item.strengthForm || '—'}</td>
                <td>{t(`prescriptionBuilder.categories.${item.category}`)}</td>
                <td>{item.defaultDose || '—'}</td>
                <td>{item.defaultFrequency || '—'}</td>
                <td>{item.defaultDuration || '—'}</td>
                <td>{item.defaultInstructions || '—'}</td>
                <td>
                  <span className={item.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {item.isActive ? t('settings.treatmentCatalog.active') : t('settings.treatmentCatalog.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  {confirmDeleteId === item.id ? (
                    <span className="treatment-history__confirm">
                      <span className="muted">{t('medicationCatalog.deleteConfirm')}</span>
                      <button
                        type="button"
                        className="link-btn link-btn--danger"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {t('common.confirm')}
                      </button>
                      <button type="button" className="link-btn" onClick={() => setConfirmDeleteId(null)}>
                        {t('common.cancel')}
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(item)}>
                        {t('common.edit')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(item)}>
                        {item.isActive
                          ? t('settings.treatmentCatalog.disable')
                          : t('settings.treatmentCatalog.enable')}
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        title={t('medicationCatalog.delete') ?? ''}
                        onClick={() => setConfirmDeleteId(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      {adding ? (
        <div className="inline-form inline-form--settings">
          <h3>{t('medicationCatalog.addTitle')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('medicationCatalog.name')}</span>
              <input autoFocus value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('medicationCatalog.strengthForm')}</span>
              <input
                value={addForm.strengthForm}
                onChange={(e) => setAddForm((f) => ({ ...f, strengthForm: e.target.value }))}
              />
            </label>
            <label className="form-field inline-form__col inline-form__col--small">
              <span className="form-field__label">{t('medicationCatalog.category')}</span>
              <select
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as MedicationCategory }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`prescriptionBuilder.categories.${c}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('medicationCatalog.defaultDose')}</span>
              <input
                value={addForm.defaultDose}
                onChange={(e) => setAddForm((f) => ({ ...f, defaultDose: e.target.value }))}
              />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('medicationCatalog.defaultFrequency')}</span>
              <input
                value={addForm.defaultFrequency}
                onChange={(e) => setAddForm((f) => ({ ...f, defaultFrequency: e.target.value }))}
              />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('medicationCatalog.defaultDuration')}</span>
              <input
                value={addForm.defaultDuration}
                onChange={(e) => setAddForm((f) => ({ ...f, defaultDuration: e.target.value }))}
              />
            </label>
          </div>
          <label className="form-field">
            <span className="form-field__label">{t('medicationCatalog.defaultInstructions')}</span>
            <input
              value={addForm.defaultInstructions}
              onChange={(e) => setAddForm((f) => ({ ...f, defaultInstructions: e.target.value }))}
            />
          </label>
          {error && <div className="form-error-banner">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setAdding(false);
                setAddForm(EMPTY_FORM);
                setError(null);
              }}
            >
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
            {t('medicationCatalog.addTitle')}
          </button>
        </div>
      )}
      {error && !adding && <div className="form-error-banner">{error}</div>}
    </Modal>
  );
}
