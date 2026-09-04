import { create } from 'zustand';
import { AuthenticatedUser } from '@/types/domain';
import { clearAiAssistantSession } from '@/store/ai-assistant.store';

const TOKEN_KEY = 'dnt-dental-token';
const USER_KEY = 'dnt-dental-user';

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AuthenticatedUser) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

function loadUser(): AuthenticatedUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  setSession: (token, user) => {
    const prevUserId = get().user?.id;
    if (prevUserId != null && prevUserId !== user.id) {
      clearAiAssistantSession(prevUserId);
    }
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    const userId = get().user?.id ?? null;
    clearAiAssistantSession(userId);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
  hasPermission: (permission: string) => {
    const user = get().user;
    return !!user?.permissions.includes(permission);
  },
}));
