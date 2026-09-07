import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, Mail, ShieldOff } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import { subscriptionApi } from '@/api/subscription.api';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function SubscriptionStatusPage() {
  const { t } = useTranslation();
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
    <div className="login-page login-page--entry">
      <AuthLangSwitch />

      <div className="subscription-status-page">
        <div className="subscription-status-card">
          <div className="subscription-status-card__brand">
            <BrandLogo variant="auth" />
          </div>

          <div className="subscription-status-card__icon">
            <Icon size={36} aria-hidden="true" />
          </div>

          <SubscriptionStatusBadge status={subStatus} />

          <h1 className="subscription-status-card__title">{t(titleKey)}</h1>
          <p className="subscription-status-card__message">{t(messageKey)}</p>

          {status?.expiresAt && subStatus === 'EXPIRED' && (
            <p className="subscription-status-card__meta">
              {t('subscription.expiredOn', { date: formatDate(status.expiresAt) })}
            </p>
          )}

          {status?.suspendedReason && subStatus === 'SUSPENDED' && (
            <p className="form-error-banner">{status.suspendedReason}</p>
          )}

          <div className="subscription-status-card__contact">
            <p>{t('subscription.contactMessage')}</p>
            <a
              href="https://dibnova.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary subscription-status-card__contact-btn"
            >
              <Mail size={16} />
              {t('subscription.contactButton')}
            </a>
          </div>
        </div>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
