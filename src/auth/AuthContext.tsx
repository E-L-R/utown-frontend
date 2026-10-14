import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { tokenStore } from '../api/client';
import type { AuthResponse, UserProfileResponse, UserRole } from '../types/api';

export interface DemoAccount {
  role: UserRole;
  label: string;
  name: string;
  phone: string;
  password: string;
  blurb: string;
  /** Extra accounts used behind the scenes (e.g. the second restaurant owner), not listed in menus. */
  hidden?: boolean;
}

// Seeded by the backend's `demo` profile. These are public demo credentials, not secrets.
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'CUSTOMER', label: 'Customer', name: 'Hungry Customer', phone: '01033333333', password: 'password123', blurb: 'Browse menus, order and track live' },
  { role: 'RESTAURANT_OWNER', label: 'Restaurant', name: 'Restaurant Owner 1', phone: '01022222222', password: 'password123', blurb: 'Run the kitchen board' },
  { role: 'RESTAURANT_OWNER', label: 'Restaurant', name: 'Restaurant Owner 2', phone: '01022222223', password: 'password123', blurb: 'Run the kitchen board', hidden: true },
  { role: 'RIDER', label: 'Rider', name: 'Speedy Rider', phone: '01044444444', password: 'password123', blurb: 'Pick up and deliver' },
  { role: 'ADMIN', label: 'Operations', name: 'Ops admin', phone: '01011111111', password: 'password123', blurb: 'Dispatch riders, watch the platform' },
];

/**
 * Demo sessions are cached per phone number so switching roles reuses a refresh token
 * instead of hitting the (rate-limited) login endpoint every time.
 */
const SESSIONS_KEY = 'utown.sessions';
type SessionCache = Record<string, AuthResponse>;

function readSessions(): SessionCache {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '{}') as SessionCache;
  } catch {
    return {};
  }
}

function writeSession(phone: string, tokens: AuthResponse | null) {
  try {
    const all = readSessions();
    if (tokens) all[phone] = tokens;
    else delete all[phone];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — sessions just aren't reused */
  }
}

const normalizePhone = (p: string) => p.replace(/\D/g, '').replace(/^82/, '0');

interface AuthContextValue {
  user: UserProfileResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<UserProfileResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.access));

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // The API client fires this when a token refresh fails.
  useEffect(() => {
    const onLogout = () => {
      setHasToken(false);
      queryClient.clear();
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [queryClient]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const key = normalizePhone(phone);
      let tokens: AuthResponse | null = null;

      const cached = readSessions()[key];
      if (cached?.refreshToken) {
        try {
          tokens = await authApi.refresh(cached.refreshToken);
        } catch {
          writeSession(key, null);
        }
      }
      tokens ??= await authApi.login({ phone, password });

      tokenStore.set(tokens);
      writeSession(key, tokens);
      const me = await authApi.me();
      // Wipe data from the previous identity. Reset (not clear) keeps mounted observers attached,
      // so already-rendered components — including this provider — pick up the new user.
      void queryClient.resetQueries();
      queryClient.setQueryData(['me'], me);
      setHasToken(true);
      return me;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const phone = meQuery.data?.phone;
    await authApi.logout();
    if (phone) writeSession(normalizePhone(phone), null);
    tokenStore.clear();
    setHasToken(false);
    queryClient.clear();
  }, [queryClient, meQuery.data?.phone]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: hasToken ? (meQuery.data ?? null) : null,
      isLoading: hasToken && meQuery.isPending,
      isAuthenticated: hasToken && Boolean(meQuery.data),
      login,
      logout,
    }),
    [hasToken, meQuery.data, meQuery.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
