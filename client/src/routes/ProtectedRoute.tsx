import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { installationApi } from '@/api/installation.api';
import { LandingPage } from '@/pages/LandingPage';

export function ProtectedRoute({ permission }: { permission?: string | string[] }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const allowed = usePermission(permission ?? []);
  const location = useLocation();
  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    if (!permission && location.pathname === '/') {
      // Public website guests should see the landing page immediately.
      // Only USB/offline clinics skip it — and only after we know the mode.
      if (installStatus?.deploymentMode === 'offline') {
        return <Navigate to="/login" replace />;
      }
      return <LandingPage />;
    }
    return <Navigate to="/login" replace />;
  }
  if (permission && !allowed) return <Navigate to="/" replace />;

  return <Outlet />;
}
