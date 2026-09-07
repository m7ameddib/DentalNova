import { create } from 'zustand';
import { AuthenticatedUser } from '@/types/domain';
import { clearAiAssistantSession } from '@/store/ai-assistant.store';

const TOKEN_KEY = 'dnt-dental-token';
const USER_KEY = 'dnt-dental-user';
const REMEMBER_USERNAME_KEY = 'dnt-dental-username';

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AuthenticatedUser, remember?: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

function loadUser(): AuthenticatedUser | null {
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatedUser;
  } catch {
    return null;
  }
}

function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getRememberedUsername(): string {
  return localStorage.getItem(REMEMBER_USERNAME_KEY) ?? '';
}

export function setRememberedUsername(username: string): void {
  const trimmed = username.trim();
  if (trimmed) {
    localStorage.setItem(REMEMBER_USERNAME_KEY, trimmed);
  } else {
    localStorage.removeItem(REMEMBER_USERNAME_KEY);
  }
}

export function clearRememberedUsername(): void {
  localStorage.removeItem(REMEMBER_USERNAME_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: loadToken(),
  user: loadUser(),
  isAuthenticated: !!loadToken(),
  setSession: (token, user, remember = true) => {
    const prevUserId = get().user?.id;
    if (prevUserId != null && prevUserId !== user.id) {
      clearAiAssistantSession(prevUserId);
    }
    clearStoredSession();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    const userId = get().user?.id ?? null;
    clearAiAssistantSession(userId);
    clearStoredSession();
    set({ token: null, user: null, isAuthenticated: false });
  },
  hasPermission: (permission: string) => {
    const user = get().user;
    return !!user?.permissions.includes(permission);
  },
}));
