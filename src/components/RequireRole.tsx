import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import type { UserRole } from '../types/api';
import { ROLE_LABEL } from '../lib/format';
import { EmptyState, LoadingState, Spinner } from './ui';

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { switchTo, pending } = useSwitchRole();
  const location = useLocation();

  if (isLoading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) {
    const target = roles[0];
    return (
      <div className="container page">
        <EmptyState icon={<ShieldAlert size={28} />} title={`This page is for the ${ROLE_LABEL[target].toLowerCase()}`}>
          <p>You're signed in as {ROLE_LABEL[user.role].toLowerCase()}. Switch demo role to continue.</p>
          <button className="btn btn--primary" disabled={pending !== null} onClick={() => switchTo(target, location.pathname)}>
            {pending ? <Spinner /> : `Continue as ${ROLE_LABEL[target].toLowerCase()}`}
          </button>
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}
