import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { installationApi, checkServerHealth, InstallationStatus } from '@/api/installation.api';
import { isClientMode } from '@/api/api-config';
import { BrandLogo } from '@/components/common/BrandLogo';
import { isPublicEntryPath } from '@/routes/public-entry-routes';
import { useAuthStore } from '@/store/auth.store';
import { getCachedInstallation, getCachedSubscription } from '@/offline/storage';
import { rememberOnlineScope } from '@/offline/scope';
import { queryClient } from '@/queryClient';
import { useOfflineStatusStore } from '@/offline/status.store';

export function InstallationGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const path = location.pathname;
  const isPublic = isPublicEntryPath(path);
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [healthCheckKey, setHealthCheckKey] = useState(0);

  const retryHealthCheck = useCallback(() => {
    setServerUp(null);
    setHealthCheckKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkServerHealth().then((ok) => {
      if (!cancelled) setServerUp(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [healthCheckKey]);

  const { data: status, isLoading, isError, isFetched } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    enabled: serverUp === true,
    retry: 1,
    staleTime: 60_000,
  });

  const [cachedOnlineReady, setCachedOnlineReady] = useState(false);
  const [fallbackChecked, setFallbackChecked] = useState(false);

  useEffect(() => {
    if (serverUp !== false) {
      setFallbackChecked(false);
      setCachedOnlineReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cached = (await getCachedInstallation()) as InstallationStatus | null;
      const authed = useAuthStore.getState().isAuthenticated;
      const canFallback =
        cached?.deploymentMode === 'online' && cached.phase === 'ready' && authed;
      if (cancelled) return;
      if (!canFallback) {
        setFallbackChecked(true);
        return;
      }
      await rememberOnlineScope(cached);
      queryClient.setQueryData(['installation-status'], cached);
      const sub = await getCachedSubscription();
      if (sub) queryClient.setQueryData(['subscription-status'], sub);
      useOfflineStatusStore.getState().setConnection('offline');
      setCachedOnlineReady(true);
      setFallbackChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [serverUp]);

  if (serverUp === false && !fallbackChecked) {
    if (isPublic) return <>{children}</>;
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if (serverUp === false && !cachedOnlineReady) {
    return (
      <div className="login-page">
        <div className="login-card setup-card">
          <div className="login-card__brand">
            <BrandLogo variant="auth" />
          </div>
          <p className="form-error-banner">{t('installation.mainServerDown')}</p>
          {isClientMode() && (
            <p className="muted">{t('installation.checkMainComputer')}</p>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={retryHealthCheck}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (serverUp === false && cachedOnlineReady) {
    const cached = queryClient.getQueryData<InstallationStatus>(['installation-status']);
    if (cached) {
      return <>{children}</>;
    }
  }

  if (serverUp === null) {
    if (isPublic) return <>{children}</>;
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if ((isLoading || !isFetched) && !status) {
    if (isPublic) return <>{children}</>;
    return <div className="page-loading">{t('common.loading')}</div>;
  }

  if ((isError || !status) && !isPublic) {
    return (
      <div className="login-page">
        <div className="login-card setup-card">
          <p className="form-error-banner">{t('installation.serverUnavailable')}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return <>{children}</>;
  }

  const isOnline = status.deploymentMode === 'online';

  if (status.phase === 'activation' && path !== '/activate') {
    return <Navigate to="/activate" replace />;
  }

  if (status.phase === 'setup') {
    if (isOnline) {
      const allowedDuringSetup = ['/login', '/setup', '/subscription-status', '/dibnova-admin'];
      if (allowedDuringSetup.includes(path) || path.startsWith('/dibnova-admin')) {
        return <>{children}</>;
      }
      return <Navigate to="/login" replace />;
    }
    if (path !== '/setup') {
      return <Navigate to="/setup" replace />;
    }
  }

  if (status.phase === 'ready' && path === '/activate') {
    return <Navigate to="/login" replace />;
  }
  if (status.phase === 'ready' && path === '/setup' && !status.canCreateClinic) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
