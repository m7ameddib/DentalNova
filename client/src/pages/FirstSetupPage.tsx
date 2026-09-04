import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { installationApi } from '@/api/installation.api';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
export function FirstSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useUiStore();
  const setSession = useAuthStore((s) => s.setSession);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [address, setAddress] = useState('');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (adminPassword !== adminPasswordConfirm) {
      setError(t('installation.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const result = await installationApi.setup({
        clinicName,
        doctorName,
        clinicPhone,
        doctorPhone,
        workingDays: '0,1,2,3,4,5,6',
        workStartTime,
        workEndTime,
        adminUsername,
        adminPassword,
        address: address.trim() || undefined,
      });
      if (result.accessToken && result.user) {
        setSession(result.accessToken, result.user);
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        t('common.error');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__lang">
        <button
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>

      <form className="login-card setup-card setup-card--wide" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
          <h1>{t('installation.setupTitle')}</h1>
        </div>
        <p className="login-card__subtitle">{t('installation.setupSubtitle')}</p>

        <div className="setup-grid">
          <label className="form-field">
            <span className="form-field__label">{t('installation.clinicName')}</span>
            <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('installation.doctorName')}</span>
            <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('installation.clinicPhone')}</span>
            <input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('installation.doctorPhone')}</span>
            <input value={doctorPhone} onChange={(e) => setDoctorPhone(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('installation.workStart')}</span>
            <input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('installation.workEnd')}</span>
            <input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} required />
          </label>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('patientRecord.patient.address')}</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </div>

        <h3 className="setup-section-title">
          <Building2 size={16} /> {t('installation.adminAccount')}
        </h3>
        <div className="setup-grid">
          <label className="form-field">
            <span className="form-field__label">{t('auth.username')}</span>
            <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} required autoComplete="username" />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('auth.password')}</span>
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('installation.confirmPassword')}</span>
            <input type="password" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
        </div>

        {error && <div className="form-error-banner">{error}</div>}

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {t('installation.completeSetup')}
        </button>
      </form>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
