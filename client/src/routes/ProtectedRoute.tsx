import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';

export function ProtectedRoute({ permission }: { permission?: string | string[] }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const allowed = usePermission(permission ?? []);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (permission && !allowed) return <Navigate to="/" replace />;

  return <Outlet />;
}
