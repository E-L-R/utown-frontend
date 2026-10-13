import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';

import CatalogPage from './pages/CatalogPage';
import RestaurantPage from './pages/RestaurantPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import RiderDashboardPage from './pages/RiderDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import LoginPage from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry 401, 403, 404
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/restaurant/:id" element={<RestaurantPage />} />
                <Route
                  path="/checkout"
                  element={
                    <RequireRole roles={['CUSTOMER']}>
                      <CheckoutPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireRole roles={['CUSTOMER']}>
                      <OrdersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <RequireRole roles={['CUSTOMER', 'RESTAURANT_OWNER', 'RIDER', 'ADMIN']}>
                      <OrderTrackingPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/owner"
                  element={
                    <RequireRole roles={['RESTAURANT_OWNER', 'ADMIN']}>
                      <OwnerDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/rider"
                  element={
                    <RequireRole roles={['RIDER', 'ADMIN']}>
                      <RiderDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireRole roles={['ADMIN']}>
                      <AdminDashboardPage />
                    </RequireRole>
                  }
                />
              </Route>

              {/* Standalone Login Screen */}
              <Route path="/login" element={<LoginPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
