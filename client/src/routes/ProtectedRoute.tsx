import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { installationApi } from '@/api/installation.api';
import { LandingPage } from '@/pages/LandingPage';
import { defaultLandingPath } from '@/utils/landingPath';

export function ProtectedRoute({ permission }: { permission?: string | string[] }) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const allowed = usePermission(permission ?? []);
  const location = useLocation();
  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    if (!permission && location.pathname === '/' && installStatus?.deploymentMode === 'online') {
      return <LandingPage />;
    }
    return <Navigate to="/login" replace />;
  }
  if (permission && !allowed) {
    const dest = defaultLandingPath(user?.permissions);
    if (dest === location.pathname) {
      return <p className="form-error-banner">{t('common.accessDenied')}</p>;
    }
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
