import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';
import { LoadingState } from './components/ui';
import { isTransientError } from './api/client';
import CatalogPage from './pages/CatalogPage';

// Role dashboards are split out so customers only download the storefront.
const RestaurantPage = lazy(() => import('./pages/RestaurantPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const OwnerDashboardPage = lazy(() => import('./pages/OwnerDashboardPage'));
const RiderDashboardPage = lazy(() => import('./pages/RiderDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep retrying (~6 minutes in total) only while the server looks asleep; 4xx/5xx responses surface immediately.
      retry: (failureCount, error) => failureCount < 3 && isTransientError(error),
      retryDelay: 1_000,
      refetchOnWindowFocus: false,
    },
  },
});

const page = (el: ReactNode) => <Suspense fallback={<LoadingState />}>{el}</Suspense>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/restaurant/:id" element={page(<RestaurantPage />)} />
                <Route path="/checkout" element={page(<RequireRole roles={['CUSTOMER']}><CheckoutPage /></RequireRole>)} />
                <Route path="/orders" element={page(<RequireRole roles={['CUSTOMER']}><OrdersPage /></RequireRole>)} />
                <Route
                  path="/orders/:id"
                  element={page(<RequireRole roles={['CUSTOMER', 'RESTAURANT_OWNER', 'RIDER', 'ADMIN']}><OrderTrackingPage /></RequireRole>)}
                />
                <Route path="/kitchen" element={page(<RequireRole roles={['RESTAURANT_OWNER', 'ADMIN']}><OwnerDashboardPage /></RequireRole>)} />
                <Route path="/rider" element={page(<RequireRole roles={['RIDER']}><RiderDashboardPage /></RequireRole>)} />
                <Route path="/ops" element={page(<RequireRole roles={['ADMIN']}><AdminDashboardPage /></RequireRole>)} />
                <Route path="/owner" element={<Navigate to="/kitchen" replace />} />
                <Route path="/admin" element={<Navigate to="/ops" replace />} />
                <Route path="*" element={page(<NotFoundPage />)} />
              </Route>
              <Route path="/login" element={page(<LoginPage />)} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
