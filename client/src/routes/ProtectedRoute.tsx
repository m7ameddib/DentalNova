import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { installationApi } from '@/api/installation.api';
import { LandingPage } from '@/pages/LandingPage';
import { defaultLandingPath } from '@/utils/landingPath';
import { StartupSplash } from '@/components/common/StartupSplash';

export function ProtectedRoute({ permission }: { permission?: string | string[] }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const allowed = usePermission(permission ?? []);
  const location = useLocation();
  const { data: installStatus, isFetched } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    if (!permission && location.pathname === '/') {
      // Wait until deployment mode is known so Offline does not flash the landing page.
      if (!isFetched && !installStatus) {
        return <StartupSplash />;
      }
      if (installStatus?.deploymentMode === 'offline') {
        return <Navigate to="/login" replace />;
      }
      return <LandingPage />;
    }
    return <Navigate to="/login" replace />;
  }
  if (permission && !allowed) {
    const dest = defaultLandingPath(user?.permissions, installStatus?.deploymentMode);
    if (dest === location.pathname) {
      return <p className="form-error-banner">{t('common.accessDenied')}</p>;
    }
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
