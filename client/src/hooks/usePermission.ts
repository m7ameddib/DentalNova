import { useAuthStore } from '@/store/auth.store';

export function usePermission(permission: string | string[]): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => user.permissions.includes(p));
}
