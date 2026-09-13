import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, KeyRound, Lock, Phone, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { authApi } from '@/api/auth.api';

type Mode = 'password' | 'username';
type Step = 'request' | 'reset';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('request');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [foundUsernames, setFoundUsernames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'username') {
        const result = await authApi.recoverUsername(phone, recoveryCode);
        setFoundUsernames(result.usernames);
        return;
      }
      const result = await authApi.forgotPassword(username, recoveryCode);
      if (!result.resetToken) {
        setError(t('auth.resetRequestError'));
        return;
      }
      setResetToken(result.resetToken);
      setStep('reset');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        t('auth.resetRequestError');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t('installation.passwordMismatch'));
      return;
    }
    if (!resetToken) {
      setError(t('auth.resetExpired'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch {
      setError(t('auth.resetExpired'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page login-page--entry">
      <AuthLangSwitch />
      <div className="login-entry login-entry--single">
        <div className="login-entry__main login-entry__main--form">
          <form className="login-form-panel" onSubmit={step === 'request' ? handleRequest : handleReset}>
            <Link to="/login" className="setup-back-link">
              <ArrowLeft size={14} /> {t('auth.backToLogin')}
            </Link>
            <div className="login-form-panel__brand">
              <BrandLogo variant="auth-lg" />
              <h1>{t('auth.forgotPasswordTitle')}</h1>
              <p className="login-form-panel__subtitle">
                {step === 'reset' ? t('auth.forgotPasswordNewSubtitle') : t('auth.recoverySubtitle')}
              </p>
            </div>

            {step === 'request' && (
              <>
                <div className="booking-mode-toggle">
                  <button
                    type="button"
                    className={mode === 'password' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
                    onClick={() => setMode('password')}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                  <button
                    type="button"
                    className={mode === 'username' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
                    onClick={() => setMode('username')}
                  >
                    {t('auth.forgotUsername')}
                  </button>
                </div>
                {mode === 'password' && (
                  <label className="form-field">
                    <span className="form-field__label">
                      <UserRound size={14} /> {t('auth.username')}
                    </span>
                    <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
                  </label>
                )}
                {mode === 'username' && (
                  <label className="form-field">
                    <span className="form-field__label">
                      <Phone size={14} /> {t('auth.accountPhone')}
                    </span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
                  </label>
                )}
                <label className="form-field">
                  <span className="form-field__label">
                    <KeyRound size={14} /> {t('auth.recoveryCode')}
                  </span>
                  <input
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </label>
                {foundUsernames && foundUsernames.length > 0 && (
                  <div className="form-success-banner">
                    {t('auth.recoveredUsernames')}: {foundUsernames.join(', ')}
                  </div>
                )}
                {foundUsernames && foundUsernames.length === 0 && (
                  <p className="muted">{t('auth.noUsernameMatch')}</p>
                )}
              </>
            )}

            {step === 'reset' && (
              <>
                <label className="form-field">
                  <span className="form-field__label">
                    <Lock size={14} /> {t('auth.newPassword')}
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">{t('installation.confirmPassword')}</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              </>
            )}

            {error && <div className="form-error-banner">{error}</div>}
            <button className="btn btn--primary btn--block login-card__submit" type="submit" disabled={loading}>
              {loading
                ? t('common.loading')
                : step === 'reset'
                  ? t('auth.updatePassword')
                  : mode === 'username'
                    ? t('auth.recoverUsername')
                    : t('auth.continueRecovery')}
            </button>
          </form>
        </div>
      </div>
      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
