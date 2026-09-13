import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, ShieldOff } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import { WhatsAppIcon } from '@/components/common/WhatsAppIcon';
import { subscriptionApi } from '@/api/subscription.api';
import { DIBNOVA_WHATSAPP_PHONE } from '@/constants/dibnova-contact';
import { buildWhatsAppUrl } from '@/utils/whatsapp';
import { isTrialPendingStatus } from '@/utils/subscription';

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

  const subStatus = status?.status ?? 'TRIAL_PENDING';
  const whatsappUrl = buildWhatsAppUrl(DIBNOVA_WHATSAPP_PHONE) ?? 'https://wa.me/96170793486';

  if (status?.canUseSystem) {
    return <Navigate to="/" replace />;
  }

  const isTrialPending = isTrialPendingStatus(subStatus);
  const isTrialExpired = subStatus === 'TRIAL_EXPIRED';
  const isPaidExpired = subStatus === 'EXPIRED';

  const titleKey = isTrialPending
    ? 'subscription.trialPendingTitle'
    : isTrialExpired
      ? 'subscription.trialExpiredTitle'
      : isPaidExpired
        ? 'subscription.expiredTitle'
        : 'subscription.suspendedTitle';

  const messageKey = isTrialPending
    ? 'subscription.trialPendingMessage'
    : isTrialExpired
      ? 'subscription.trialExpiredMessage'
      : isPaidExpired
        ? 'subscription.expiredMessage'
        : 'subscription.suspendedMessage';

  const Icon = isTrialPending ? Clock : isTrialExpired || isPaidExpired ? AlertCircle : ShieldOff;

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

          {isTrialExpired && (
            <div className="subscription-renew-offer">
              <p className="subscription-renew-offer__title">{t('subscription.renewTitle')}</p>
              <div className="login-offer__prices">
                <span className="login-offer__was">{t('auth.priceYearWas')}</span>
                <strong className="login-offer__now">{t('auth.priceYearNow')}</strong>
              </div>
            </div>
          )}

          {status?.expiresAt && (isTrialExpired || isPaidExpired) && (
            <p className="subscription-status-card__meta">
              {t('subscription.expiredOn', { date: formatDate(status.expiresAt) })}
            </p>
          )}

          {status?.suspendedReason && subStatus === 'SUSPENDED' && (
            <p className="form-error-banner">{status.suspendedReason}</p>
          )}

          <div className="subscription-status-card__contact">
            <p>
              {isTrialExpired
                ? t('subscription.renewContact')
                : isTrialPending
                  ? t('subscription.contactWhatsAppHint')
                  : t('subscription.contactMessage')}
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary subscription-status-card__contact-btn"
            >
              <WhatsAppIcon />
              {isTrialExpired ? t('subscription.renewWhatsApp') : t('auth.contactWhatsApp')}
            </a>
            {(isTrialPending || isTrialExpired) && (
              <p className="login-card__support-hint">{t('auth.contactWhatsAppHint')}</p>
            )}
          </div>
        </div>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
