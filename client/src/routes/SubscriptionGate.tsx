import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription.api';
import { installationApi } from '@/api/installation.api';
import { isPublicEntryPath } from '@/routes/public-entry-routes';

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isPublic = isPublicEntryPath(location.pathname);

  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  const needsSubscriptionCheck =
    !isPublic &&
    installStatus?.phase === 'ready' &&
    installStatus.deploymentMode === 'online';

  const { data: subStatus, isLoading, isFetched } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.status,
    enabled: needsSubscriptionCheck,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isPublic || !needsSubscriptionCheck) {
    return <>{children}</>;
  }

  if ((isLoading || !isFetched) && !subStatus) {
    return <div className="page-loading" />;
  }

  if (!subStatus?.canUseSystem) {
    return <Navigate to="/subscription-status" replace />;
  }

  return <>{children}</>;
}
