import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Phone } from 'lucide-react';
import { DEMO_ACCOUNTS, useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { getErrorMessage } from '../api/client';
import { useToast } from '../components/Toast';
import { ROLE_ICON } from '../components/Header';
import { Spinner, useDocumentTitle } from '../components/ui';
import { ROLE_HOME, cx } from '../lib/format';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const { switchTo, pending } = useSwitchRole();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;
    setLoading(true);
    try {
      const user = await login(phone.trim(), password);
      notify(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      navigate(from || ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      notify(getErrorMessage(err, 'Sign in failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__visual">
        <img src="/images/hero.webp" alt="" />
        <Link to="/" className="brand" style={{ color: '#fff' }}>
          <span className="brand__mark">u</span>
          <span>utown<em>.</em></span>
        </Link>
        <div>
          <h2>Four apps, one order, real-time.</h2>
          <p className="hide-sm-auth">
            Customers order, kitchens cook, riders deliver and operations keeps it all moving — every screen backed by the same Spring Boot API.
          </p>
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__box">
          <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to restaurants</Link>
          <h1 style={{ fontSize: '1.9rem' }}>Jump into a role</h1>
          <p className="muted" style={{ margin: '6px 0 22px' }}>One click signs you in as a seeded demo account. No sign-up needed.</p>

          <div className="role-grid">
            {DEMO_ACCOUNTS.filter((a) => !a.hidden).map((a) => {
              const Icon = ROLE_ICON[a.role];
              return (
                <button
                  key={a.role}
                  type="button"
                  className="role-card"
                  disabled={pending !== null || loading}
                  onClick={() => switchTo(a.role, from)}
                  id={`login-demo-${a.role.toLowerCase()}`}
                >
                  <span className={cx('role-icon', `role--${a.role.toLowerCase()}`)}>
                    {pending === a.role ? <Spinner size={16} /> : <Icon size={18} />}
                  </span>
                  <strong>{a.label}</strong>
                  <small>{a.blurb}</small>
                </button>
              );
            })}
          </div>

          <div className="or">or sign in with a phone number</div>

          <form onSubmit={handleSubmit} className="stack">
            <label className="field">
              <span>Phone number</span>
              <div className="input-icon">
                <Phone size={16} />
                <input className="input" type="tel" inputMode="tel" autoComplete="username" placeholder="010 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} required id="login-phone-input" />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div className="input-icon">
                <Lock size={16} />
                <input className="input" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required id="login-password-input" />
              </div>
            </label>
            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={loading || pending !== null} id="login-submit-button">
              {loading ? <Spinner /> : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
