import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types/api';
import { ROLE_LABEL } from '../lib/format';
import { EmptyState, LoadingState } from './ui';

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) {
    return (
      <div className="container section">
        <EmptyState icon={<ShieldAlert size={28} />} title="Wrong role for this page">
          This area is for {roles.map((r) => ROLE_LABEL[r]).join(' / ')}. Use the demo switcher in the header to change role.
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}
