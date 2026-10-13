import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bike,
  ChefHat,
  Lock,
  Phone,
  Shield,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { DEMO_ACCOUNTS, useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../api/client';
import { useToast } from '../components/Toast';
import { Spinner } from '../components/ui';
import { ROLE_HOME } from '../lib/format';
import type { UserRole } from '../types/api';

const ROLE_ICON: Record<UserRole, typeof UserRound> = {
  CUSTOMER: UserRound,
  RESTAURANT_OWNER: ChefHat,
  RIDER: Bike,
  ADMIN: Shield,
};

export default function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoPending, setDemoPending] = useState<UserRole | null>(null);

  const from = (location.state as { from?: string })?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;
    setLoading(true);
    try {
      const user = await login(phone.trim(), password);
      notify(`Welcome back, ${user.name}!`, 'success');
      navigate(from || ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      notify(getErrorMessage(err, 'Sign in failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account: (typeof DEMO_ACCOUNTS)[0]) => {
    setDemoPending(account.role);
    try {
      const user = await login(account.phone, account.password);
      notify(`Signed in as ${user.name} (${account.label})`, 'success');
      navigate(from || ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      notify(getErrorMessage(err, 'Demo sign in failed'), 'error');
    } finally {
      setDemoPending(null);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="login-head center">
          <div className="brand brand--lg">
            <span className="brand__mark">U</span>
            <span className="brand__name">
              UTown<em>.eats</em>
            </span>
          </div>
          <h1 className="text-xl mt-sm">Welcome to UTown</h1>
          <p className="muted text-sm mt-xs">
            Sign in to start ordering or switch into a demo role
          </p>
        </div>

        {/* 1-Click Demo Accounts */}
        <div className="demo-accounts-box mt-lg">
          <div className="row items-center gap-xs text-xs font-semibold uppercase text-accent mb-sm">
            <Sparkles size={14} /> 1-Click Demo Test Accounts
          </div>
          <div className="grid grid-cols-2 gap-sm">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = ROLE_ICON[account.role];
              const isPending = demoPending === account.role;
              return (
                <button
                  key={account.role}
                  type="button"
                  className="demo-card-btn"
                  disabled={demoPending !== null || loading}
                  onClick={() => handleDemoLogin(account)}
                  id={`login-demo-${account.role.toLowerCase()}`}
                >
                  <span className={`role-icon role-icon--${account.role.toLowerCase()}`}>
                    {isPending ? <Spinner size={16} /> : <Icon size={16} />}
                  </span>
                  <div className="text-left">
                    <strong className="block text-sm">{account.label}</strong>
                    <span className="text-xs muted block line-clamp">{account.blurb}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="auth-separator my-lg">
          <span>or sign in with credentials</span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex-col gap-md">
          <label className="field">
            <span>Phone Number</span>
            <div className="input-with-icon">
              <Phone size={16} className="text-muted" />
              <input
                type="tel"
                placeholder="01033333333"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                id="login-phone-input"
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-with-icon">
              <Lock size={16} className="text-muted" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                id="login-password-input"
              />
            </div>
          </label>

          <button
            type="submit"
            className="btn btn--primary btn--block btn--lg mt-sm"
            disabled={loading || demoPending !== null}
            id="login-submit-button"
          >
            {loading ? <Spinner size={18} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
