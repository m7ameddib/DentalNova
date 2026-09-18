import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS } from '@/components/admin/admin-utils';
import { dibnovaAdminApi, type AdminClinicUser } from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    isOnline,
    clinicReady,
    selectedClinic,
    selectedClinicId,
    clinicUsers,
    resetUserId,
    setResetUserId,
    resetPassword,
    setResetPassword,
    confirmAction,
    setSuccess,
    setError,
    invalidate,
  } = useAdminDashboard();

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.usersTitle')}
        description={t('dibnovaAdmin.usersHint')}
        crumbs={[
          { label: t('dibnovaAdmin.nav.clinics'), to: ADMIN_PATHS.clinics },
          { label: t('dibnovaAdmin.nav.users') },
        ]}
      />

      {isOnline && clinicReady && selectedClinic && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.usersTitle')}</h2>
          {clinicUsers.length === 0 ? (
            <p className="muted">{t('dibnovaAdmin.usersEmpty')}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('settings.fullName')}</th>
                    <th>{t('settings.username')}</th>
                    <th>{t('settings.role')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicUsers.map((user: AdminClinicUser) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.username}</td>
                      <td>
                        <select
                          value={user.roleName === 'employee' ? 'employee' : 'doctor'}
                          onChange={(e) => {
                            const roleName = e.target.value as 'doctor' | 'employee';
                            if (!confirmAction('dibnovaAdmin.roleConfirm', { name: user.fullName, role: roleName })) {
                              return;
                            }
                            void dibnovaAdminApi
                              .setUserRole(selectedClinicId, user.id, roleName)
                              .then(() => {
                                setSuccess(t('dibnovaAdmin.success.role'));
                                invalidate();
                                queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
                              })
                              .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                          }}
                        >
                          <option value="doctor">{t('dibnovaAdmin.roleDoctor')}</option>
                          <option value="employee">{t('dibnovaAdmin.roleEmployee')}</option>
                        </select>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${user.isActive ? 'status-badge--active' : 'status-badge--muted'}`}
                        >
                          {user.isActive ? t('dibnovaAdmin.userActive') : t('dibnovaAdmin.userInactive')}
                        </span>
                      </td>
                      <td>
                        <div className="table-row-actions">
                          {resetUserId === user.id ? (
                            <>
                              <input
                                type="password"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                placeholder={t('auth.newPassword')}
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                className="btn btn--primary btn--small"
                                onClick={() => {
                                  if (!window.confirm(t('dibnovaAdmin.resetPasswordConfirm', { name: user.fullName }))) {
                                    return;
                                  }
                                  void dibnovaAdminApi
                                    .resetUserPassword(selectedClinicId, user.id, resetPassword)
                                    .then(() => {
                                      setResetUserId(null);
                                      setResetPassword('');
                                      setSuccess(t('dibnovaAdmin.success.resetPassword'));
                                    })
                                    .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                                }}
                              >
                                {t('common.save')}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--ghost btn--small"
                              onClick={() => {
                                setResetUserId(user.id);
                                setResetPassword('');
                              }}
                            >
                              {t('dibnovaAdmin.resetPassword')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            onClick={() => {
                              if (
                                !confirmAction(
                                  user.isActive ? 'dibnovaAdmin.deactivateConfirm' : 'dibnovaAdmin.activateUserConfirm',
                                  { name: user.fullName },
                                )
                              ) {
                                return;
                              }
                              void dibnovaAdminApi
                                .setUserStatus(selectedClinicId, user.id, !user.isActive)
                                .then(() => {
                                  setSuccess(
                                    t(user.isActive ? 'dibnovaAdmin.success.deactivate' : 'dibnovaAdmin.success.activateUser'),
                                  );
                                  invalidate();
                                  queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
                                })
                                .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                            }}
                          >
                            {user.isActive ? t('dibnovaAdmin.deactivateUser') : t('dibnovaAdmin.activateUser')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => {
              if (!window.confirm(t('auth.recoveryCodeConfirm'))) return;
              void dibnovaAdminApi
                .issueRecoveryCode(selectedClinicId)
                .then((r) => {
                  setSuccess(`${t('auth.recoveryCodeOnce')}: ${r.recoveryCode}`);
                })
                .catch((err) => setError(getErrorMessage(err, t('common.error'))));
            }}
          >
            {t('auth.issueRecoveryCode')}
          </button>
        </section>
      )}
    </div>
  );
}
