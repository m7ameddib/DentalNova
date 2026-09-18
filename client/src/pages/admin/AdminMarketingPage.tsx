import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { WhatsAppIcon } from '@/components/common/WhatsAppIcon';

export function AdminMarketingPage() {
  const { t } = useTranslation();
  const {
    isOnline,
    marketingDoctor,
    setMarketingDoctor,
    marketingPhone,
    setMarketingPhone,
    marketingPending,
    mutateMarketing,
    createdMarketing,
    sendTrialWhatsApp,
    activateTrialPending,
    mutateActivateTrial,
  } = useAdminDashboard();

  if (!isOnline) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.marketingTrialTitle')}
        description={t('dibnovaAdmin.marketingTrialHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.marketing') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.marketingTrialTitle')}</h2>
        <div className="setup-grid">
          <label className="form-field">
            <span className="form-field__label">{t('dibnovaAdmin.doctorName')}</span>
            <input value={marketingDoctor} onChange={(e) => setMarketingDoctor(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('dibnovaAdmin.clinicPhone')}</span>
            <input value={marketingPhone} onChange={(e) => setMarketingPhone(e.target.value)} />
          </label>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={marketingPending || !marketingDoctor.trim() || !marketingPhone.trim()}
            onClick={() => mutateMarketing()}
          >
            {t('dibnovaAdmin.createMarketingTrial')}
          </button>
        </div>
        {createdMarketing && (
          <div className="admin-info-table-wrap">
            <table className="admin-info-table">
              <tbody>
                <tr>
                  <th>{t('auth.username')}</th>
                  <td className="mono-text">{createdMarketing.username}</td>
                </tr>
                <tr>
                  <th>{t('auth.password')}</th>
                  <td className="mono-text">{createdMarketing.password}</td>
                </tr>
              </tbody>
            </table>
            <div className="admin-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  sendTrialWhatsApp(createdMarketing.phone, createdMarketing.username, createdMarketing.password)
                }
              >
                <WhatsAppIcon />
                {t('dibnovaAdmin.sendTrialWhatsApp')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={activateTrialPending}
                onClick={() => mutateActivateTrial(createdMarketing.clinicId)}
              >
                {t('dibnovaAdmin.activateTrial')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
