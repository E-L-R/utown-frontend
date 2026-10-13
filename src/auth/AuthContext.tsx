import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { tokenStore } from '../api/client';
import type { UserProfileResponse, UserRole } from '../types/api';

export interface DemoAccount {
  role: UserRole;
  label: string;
  phone: string;
  password: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'CUSTOMER', label: 'Customer', phone: '01033333333', password: 'password123', blurb: 'Browse, order & track' },
  { role: 'RESTAURANT_OWNER', label: 'Restaurant Owner', phone: '01022222222', password: 'password123', blurb: 'Accept & prepare orders' },
  { role: 'RIDER', label: 'Rider', phone: '01044444444', password: 'password123', blurb: 'Pick up & deliver' },
  { role: 'ADMIN', label: 'Admin', phone: '01011111111', password: 'password123', blurb: 'Dispatch riders' },
];

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

  // Interceptor fires this when refresh fails.
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
      const tokens = await authApi.login({ phone, password });
      tokenStore.set(tokens);
      // Drop every cached query from a previous identity.
      queryClient.clear();
      const me = await authApi.me();
      queryClient.setQueryData(['me'], me);
      setHasToken(true);
      return me;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    tokenStore.clear();
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

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
