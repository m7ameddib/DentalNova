import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { getErrorMessage } from '@/utils/errors';
import { UserSummary } from '@/types/domain';

export function UsersSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => usersApi.roles() });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      invalidate();
      setFullName('');
      setUsername('');
      setPassword('');
      setRoleName('');
      setError(null);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setEditPassword('');
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function startEdit(user: UserSummary) {
    setEditingId(user.id);
    setEditFullName(user.fullName);
    setEditRoleName(user.roleName);
    setEditPassword('');
    setError(null);
  }

  function saveEdit(id: number) {
    const payload: Parameters<typeof usersApi.update>[1] = {
      fullName: editFullName.trim(),
      roleName: editRoleName,
    };
    if (editPassword.trim()) {
      payload.password = editPassword;
    }
    updateUserMutation.mutate({ id, payload });
  }

  function toggleActive(user: UserSummary) {
    updateUserMutation.mutate({ id: user.id, payload: { isActive: !user.isActive } });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.usersTitle')}</h2>

      <table className="patients-table">
        <thead>
          <tr>
            <th>{t('settings.fullName')}</th>
            <th>{t('settings.username')}</th>
            <th>{t('settings.role')}</th>
            <th>{t('settings.newPassword')}</th>
            <th>{t('settings.status')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) =>
            editingId === u.id ? (
              <tr key={u.id}>
                <td>
                  <input autoFocus value={editFullName} onChange={(e) => setEditFullName(e.target.value)} autoComplete="off" />
                </td>
                <td>{u.username}</td>
                <td>
                  <select value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={t('settings.newPasswordHint') ?? ''}
                    autoComplete="new-password"
                  />
                </td>
                <td>
                  <span className={u.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {u.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => saveEdit(u.id)}
                    disabled={updateUserMutation.isPending}
                  >
                    {t('common.save')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={u.id} className={!u.isActive ? 'catalog-row--inactive' : undefined}>
                <td>{u.fullName}</td>
                <td>{u.username}</td>
                <td>{u.roleLabel}</td>
                <td className="muted">—</td>
                <td>
                  <span className={u.isActive ? 'status-chip status-chip--completed' : 'status-chip'}>
                    {u.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="catalog-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEdit(u)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => toggleActive(u)}>
                    {u.isActive ? t('common.disable') : t('common.enable')}
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="inline-form inline-form--settings">
        <h3>{t('settings.addUser')}</h3>
        <div className="inline-form__row">
          <label className="form-field inline-form__col">
            <span className="form-field__label">{t('settings.fullName')}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
          </label>
          <label className="form-field inline-form__col">
            <span className="form-field__label">{t('settings.username')}</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </label>
        </div>
        <div className="inline-form__row">
          <label className="form-field inline-form__col">
            <span className="form-field__label">{t('settings.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="form-field inline-form__col">
            <span className="form-field__label">{t('settings.role')}</span>
            <select value={roleName} onChange={(e) => setRoleName(e.target.value)}>
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="form-error-banner">{error}</div>}
        <div className="form-actions">
          <button
            className="btn btn--primary"
            onClick={() => createUserMutation.mutate({ fullName, username, password, roleName })}
            disabled={!fullName || !username || !password || !roleName || createUserMutation.isPending}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
