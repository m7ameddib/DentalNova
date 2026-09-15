import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription.api';
import { installationApi } from '@/api/installation.api';
import { isGuestHomePath, isPublicEntryPath } from '@/routes/public-entry-routes';
import { queryClient } from '@/queryClient';
import { useOfflineStatusStore } from '@/offline/status.store';
import { useAuthStore } from '@/store/auth.store';
import { isCachedSubscriptionUsable } from '@/utils/subscription';
import { StartupSplash } from '@/components/common/StartupSplash';

const OFFLINE_SUBSCRIPTION_GRACE_MS = 48 * 60 * 60 * 1000;

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPublic =
    isPublicEntryPath(location.pathname) || isGuestHomePath(location.pathname, isAuthenticated);

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
    const cached = queryClient.getQueryData<{
      canUseSystem?: boolean;
      expiresAt?: string | null;
      status?: string;
    }>(['subscription-status']);
    const offline = useOfflineStatusStore.getState().enabled && useOfflineStatusStore.getState().connection !== 'online';
    if (isCachedSubscriptionUsable(cached, { offline, graceMs: OFFLINE_SUBSCRIPTION_GRACE_MS })) {
      return <>{children}</>;
    }
    if (cached && cached.canUseSystem === false) {
      return <Navigate to="/subscription-status" replace />;
    }
    if (offline) {
      return <Navigate to="/subscription-status" replace />;
    }
    return <StartupSplash />;
  }

  if (!subStatus?.canUseSystem) {
    return <Navigate to="/subscription-status" replace />;
  }

  return <>{children}</>;
}
