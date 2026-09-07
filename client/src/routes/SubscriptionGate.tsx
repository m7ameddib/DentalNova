import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/api/subscription.api';
import { installationApi } from '@/api/installation.api';

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();

  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
  });

  const { data: subStatus, isLoading } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.status,
    enabled: installStatus?.phase === 'ready' && installStatus.deploymentMode === 'online',
    refetchInterval: 60_000,
  });

  if (installStatus?.phase !== 'ready' || installStatus.deploymentMode !== 'online') {
    return <>{children}</>;
  }

  if (isLoading || !subStatus) {
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if (subStatus.canUseSystem) {
    if (location.pathname === '/subscription-status') {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  const allowedWhileBlocked =
    location.pathname === '/login' ||
    location.pathname === '/subscription-status' ||
    location.pathname.startsWith('/dibnova-admin');

  if (!allowedWhileBlocked) {
    return <Navigate to="/subscription-status" replace />;
  }

  return <>{children}</>;
}
