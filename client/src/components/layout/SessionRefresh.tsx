import { useEffect } from 'react';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';

/**
 * Reloads the logged-in user from the server so permissions added by
 * Update / New Install (e.g. AI Assistant) appear without requiring logout.
 */
export function SessionRefresh() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setSession(token, user);
      })
      .catch(() => {
        /* 401 is handled by the API interceptor (logout). */
      });
    return () => {
      cancelled = true;
    };
  }, [token, setSession]);

  return null;
}
