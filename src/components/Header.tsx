import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Bike, ChefHat, ChevronDown, LayoutDashboard, LogIn, LogOut, Moon, Receipt, Search, ShoppingBag, Sun, UserRound } from 'lucide-react';
import { DEMO_ACCOUNTS, useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { useCart } from '../hooks/queries';
import { ROLE_HOME, ROLE_LABEL, cx, initials } from '../lib/format';
import type { Theme } from '../lib/theme';
import { Spinner } from './ui';
import type { UserRole } from '../types/api';

export const ROLE_ICON: Record<UserRole, typeof UserRound> = {
  CUSTOMER: UserRound,
  RESTAURANT_OWNER: ChefHat,
  RIDER: Bike,
  ADMIN: LayoutDashboard,
};

function AccountMenu() {
  const { user, logout } = useAuth();
  const { switchTo, pending } = useSwitchRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        id="account-menu"
        className={cx('user-chip', !user && 'user-chip--guest')}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user ? (
          <span className={cx('avatar', `role--${user.role.toLowerCase()}`)}>{initials(user.name)}</span>
        ) : (
          <LogIn size={16} />
        )}
        <span className="hide-sm">{user ? user.name.split(' ')[0] : 'Try a demo role'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu__panel" role="menu">
          {user && (
            <>
              <div className="row" style={{ padding: '8px 10px 10px', gap: 12 }}>
                <span className={cx('avatar avatar--lg', `role--${user.role.toLowerCase()}`)}>{initials(user.name)}</span>
                <span className="grow">
                  <strong className="truncate" style={{ display: 'block' }}>{user.name}</strong>
                  <small className="muted">{ROLE_LABEL[user.role]} · {user.email}</small>
                </span>
              </div>
              <div className="menu__sep" />
            </>
          )}
          <p className="menu__label">Switch demo role</p>
          {DEMO_ACCOUNTS.filter((a) => !a.hidden).map((a) => {
            const I = ROLE_ICON[a.role];
            const active = user?.role === a.role;
            return (
              <button
                key={a.role}
                role="menuitem"
                id={`demo-${a.role.toLowerCase()}`}
                className={cx('menu__item', active && 'is-active')}
                disabled={pending !== null}
                onClick={async () => {
                  if (await switchTo(a.role)) setOpen(false);
                }}
              >
                <span className={cx('role-icon', `role--${a.role.toLowerCase()}`)}>{pending === a.role ? <Spinner size={16} /> : <I size={17} />}</span>
                <span className="grow">
                  <strong>{a.label}</strong>
                  <small>{a.blurb}</small>
                </span>
                {active && <span className="badge badge--accent">You</span>}
              </button>
            );
          })}
          <div className="menu__sep" />
          {user ? (
            <button
              role="menuitem"
              className="menu__item"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/');
              }}
            >
              <span className="role-icon" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                <LogOut size={16} />
              </span>
              <strong>Sign out</strong>
            </button>
          ) : (
            <Link to="/login" className="menu__item" onClick={() => setOpen(false)}>
              <span className="role-icon" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                <LogIn size={16} />
              </span>
              <strong>Sign in with a phone number</strong>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ onCartClick, theme, onToggleTheme }: { onCartClick: () => void; theme: Theme; onToggleTheme: () => void }) {
  const { user } = useAuth();
  const { data: cart } = useCart();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const [q, setQ] = useState(params.get('q') ?? '');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  // "/" focuses search, like most product UIs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  const role = user?.role;
  const showSearch = !role || role === 'CUSTOMER';

  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <Link to="/" className="brand" aria-label="UTown home">
          <span className="brand__mark">u</span>
          <span className="brand__name">
            utown<em>.</em>
          </span>
        </Link>

        {showSearch && (
          <form className="search-field" onSubmit={submit} role="search">
            <Search size={16} />
            <input
              ref={inputRef}
              id="header-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search restaurants or dishes"
              aria-label="Search restaurants"
            />
            {!q && <kbd>/</kbd>}
          </form>
        )}

        <nav className="nav hide-sm" aria-label="Primary">
          {role === 'CUSTOMER' && (
            <NavLink to="/orders" className="nav-link">
              <Receipt size={16} /> Orders
            </NavLink>
          )}
          {(role === 'RESTAURANT_OWNER' || role === 'ADMIN') && (
            <NavLink to="/kitchen" className="nav-link">
              <ChefHat size={16} /> Kitchen
            </NavLink>
          )}
          {role === 'RIDER' && (
            <NavLink to="/rider" className="nav-link">
              <Bike size={16} /> Deliveries
            </NavLink>
          )}
          {role === 'ADMIN' && (
            <NavLink to="/ops" className="nav-link">
              <LayoutDashboard size={16} /> Operations
            </NavLink>
          )}
          {role && role !== 'CUSTOMER' && (
            <NavLink to="/" end className={() => cx('nav-link', pathname === '/' && 'active')}>
              Restaurants
            </NavLink>
          )}
        </nav>

        <div className="topbar__right">
          <button className="icon-btn" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {role && role !== 'CUSTOMER' && (
            <NavLink to={ROLE_HOME[role]} className="icon-btn show-sm" aria-label={`${ROLE_LABEL[role]} home`}>
              {(() => {
                const I = ROLE_ICON[role];
                return <I size={19} />;
              })()}
            </NavLink>
          )}
          {role === 'CUSTOMER' && (
            <>
              <NavLink to="/orders" className="icon-btn show-sm" aria-label="Orders">
                <Receipt size={19} />
              </NavLink>
              <button id="cart-button" className="icon-btn" onClick={onCartClick} aria-label={`Bag, ${count} items`}>
                <ShoppingBag size={19} />
                {count > 0 && <span key={count} className="count-dot">{count}</span>}
              </button>
            </>
          )}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
