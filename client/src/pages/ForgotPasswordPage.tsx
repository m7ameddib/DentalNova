import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Lock, Phone, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { authApi } from '@/api/auth.api';
import { installationApi } from '@/api/installation.api';

type Step = 'request' | 'verify' | 'reset';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
  });

  const isOnline = installStatus?.deploymentMode === 'online';

  const [step, setStep] = useState<Step>('request');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await authApi.forgotPassword(username, phone);
      setInfo(result.message);
      setStep('verify');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        t('auth.resetRequestError');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.verifyResetOtp(username, phone, code);
      setResetToken(result.resetToken);
      setStep('reset');
    } catch {
      setError(t('auth.resetInvalidCode'));
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
      navigate('/login', {
        replace: true,
        state: { resetSuccess: true },
      });
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
          <form
            className="login-form-panel"
            onSubmit={
              step === 'request' ? handleRequest : step === 'verify' ? handleVerify : handleReset
            }
          >
            <Link to="/login" className="setup-back-link">
              <ArrowLeft size={14} /> {t('auth.backToLogin')}
            </Link>

            <div className="login-form-panel__brand">
              <BrandLogo variant="auth-lg" />
              <h1>{t('auth.forgotPasswordTitle')}</h1>
              <p className="login-form-panel__subtitle">
                {step === 'request' && t('auth.forgotPasswordSubtitle')}
                {step === 'verify' && t('auth.forgotPasswordOtpSubtitle')}
                {step === 'reset' && t('auth.forgotPasswordNewSubtitle')}
              </p>
            </div>

            {!isOnline && installStatus && (
              <div className="form-info-banner">{t('auth.forgotPasswordOfflineHint')}</div>
            )}

            {step === 'request' && (
              <>
                <label className="form-field">
                  <span className="form-field__label">
                    <UserRound size={14} /> {t('auth.username')}
                  </span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    disabled={!isOnline}
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">
                    <Phone size={14} /> {t('auth.accountPhone')}
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder={t('auth.accountPhonePlaceholder') ?? ''}
                    required
                    disabled={!isOnline}
                  />
                </label>
              </>
            )}

            {step === 'verify' && (
              <>
                {info && <div className="form-info-banner">{info}</div>}
                <label className="form-field">
                  <span className="form-field__label">
                    <KeyRound size={14} /> {t('auth.verificationCode')}
                  </span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                    disabled={!isOnline}
                  />
                </label>
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
                    disabled={!isOnline}
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
                    disabled={!isOnline}
                  />
                </label>
              </>
            )}

            {error && <div className="form-error-banner">{error}</div>}

            {isOnline && (
              <button className="btn btn--primary btn--block login-card__submit" type="submit" disabled={loading}>
                {loading
                  ? t('common.loading')
                  : step === 'request'
                    ? t('auth.sendVerificationCode')
                    : step === 'verify'
                      ? t('auth.verifyCode')
                      : t('auth.updatePassword')}
              </button>
            )}
          </form>
        </div>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
