import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, ProblemDetail } from '../types/api';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || 'https://utown-backend.onrender.com';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthResponse) {
    localStorage.setItem(ACCESS_KEY, tokens.token);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Render free tier can cold-start; give it time.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Shared in-flight refresh so parallel 401s trigger only one refresh call. */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) throw new Error('No refresh token');
  const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/refresh`, {
    refreshToken,
  });
  tokenStore.set(data);
  return data.token;
}

const AUTH_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/register'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const isAuthCall = AUTH_PATHS.some((p) => originalRequest?.url?.includes(p));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;
      if (tokenStore.refresh) {
        try {
          refreshPromise ??= refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
          const newToken = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } catch {
          // Protected routes redirect on their own; public pages just fall back to guest.
          tokenStore.clear();
          window.dispatchEvent(new Event('auth:logout'));
        }
      }
    }
    return Promise.reject(error);
  },
);

/** Turns any thrown value into a human-readable message (handles RFC 7807 problem details). */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ProblemDetail | string | undefined;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object') {
      if (data.detail) return data.detail;
      if (data.title) return data.title;
    }
    if (err.response?.status === 429) return 'Too many requests — give it a few seconds and try again.';
    if (err.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
    if (!err.response) return 'Network error — is the backend reachable?';
    return `${fallback} (HTTP ${err.response.status})`;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function getErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}
