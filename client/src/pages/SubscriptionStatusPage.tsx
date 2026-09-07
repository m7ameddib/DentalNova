import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, ShieldOff } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { subscriptionApi } from '@/api/subscription.api';
import { useUiStore } from '@/store/ui.store';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function SubscriptionStatusPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useUiStore();
  const { data: status } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.status,
    refetchInterval: 30_000,
  });

  const subStatus = status?.status ?? 'PENDING';

  const titleKey =
    subStatus === 'PENDING'
      ? 'subscription.pendingTitle'
      : subStatus === 'EXPIRED'
        ? 'subscription.expiredTitle'
        : 'subscription.suspendedTitle';

  const messageKey =
    subStatus === 'PENDING'
      ? 'subscription.pendingMessage'
      : subStatus === 'EXPIRED'
        ? 'subscription.expiredMessage'
        : 'subscription.suspendedMessage';

  const Icon =
    subStatus === 'PENDING' ? Clock : subStatus === 'EXPIRED' ? AlertCircle : ShieldOff;

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

      <div className="login-card setup-card">
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
          <Icon size={32} className="subscription-status-icon" />
          <h1>{t(titleKey)}</h1>
        </div>
        <p className="login-card__subtitle">{t(messageKey)}</p>

        {status?.expiresAt && subStatus === 'EXPIRED' && (
          <p className="muted">{t('subscription.expiredOn', { date: formatDate(status.expiresAt) })}</p>
        )}

        {status?.suspendedReason && subStatus === 'SUSPENDED' && (
          <p className="form-error-banner">{status.suspendedReason}</p>
        )}

        <p className="muted">{t('subscription.contactDibNova')}</p>
        <p className="muted">
          <Link to="/dibnova-admin">{t('dibnovaAdmin.openPanel')}</Link>
        </p>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
