import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Bike, ChefHat, ChevronDown, LogOut, MapPin, Search, Shield, ShoppingBag, User, UserRound } from 'lucide-react';
import { DEMO_ACCOUNTS, useAuth } from '../auth/AuthContext';
import { useAddresses, useCart, useCities } from '../hooks/queries';
import { ROLE_HOME, ROLE_LABEL, cx } from '../lib/format';
import { getErrorMessage } from '../api/client';
import { useToast } from './Toast';
import { Spinner } from './ui';
import type { UserRole } from '../types/api';

const ROLE_ICON: Record<UserRole, typeof User> = {
  CUSTOMER: UserRound,
  RESTAURANT_OWNER: ChefHat,
  RIDER: Bike,
  ADMIN: Shield,
};

function AddressBadge() {
  const { data: addresses } = useAddresses();
  const { data: cities } = useCities();
  const addr = addresses?.[0];
  const city = cities?.find((c) => c.id === addr?.cityId);
  return (
    <Link to="/checkout" className="address-badge" title="Delivery address">
      <MapPin size={15} />
      <span className="address-badge__text">
        <small>Deliver to</small>
        <strong>{addr ? `${addr.label || addr.addressLine}${city ? `, ${city.name}` : ''}` : 'Add address'}</strong>
      </span>
    </Link>
  );
}

function DemoSwitcher() {
  const { user, login, logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<UserRole | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const switchTo = async (role: UserRole) => {
    const acct = DEMO_ACCOUNTS.find((a) => a.role === role)!;
    setPending(role);
    try {
      const me = await login(acct.phone, acct.password);
      notify(`Signed in as ${me.name}`, 'success');
      setOpen(false);
      navigate(ROLE_HOME[me.role]);
    } catch (e) {
      notify(getErrorMessage(e, 'Login failed'), 'error');
    } finally {
      setPending(null);
    }
  };

  const CurrentIcon = user ? ROLE_ICON[user.role] : User;

  return (
    <div className="dropdown" ref={ref}>
      <button id="demo-switcher" className="btn btn--ghost btn--pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CurrentIcon size={16} />
        <span className="hide-sm">{user ? user.name : 'Demo login'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="dropdown__menu">
          <p className="dropdown__label">Quick demo switch</p>
          {DEMO_ACCOUNTS.map((a) => {
            const I = ROLE_ICON[a.role];
            const active = user?.role === a.role;
            return (
              <button
                key={a.role}
                id={`demo-${a.role.toLowerCase()}`}
                className={cx('dropdown__item', active && 'is-active')}
                onClick={() => switchTo(a.role)}
                disabled={pending !== null}
              >
                <span className={`role-icon role-icon--${a.role.toLowerCase()}`}>
                  {pending === a.role ? <Spinner size={16} /> : <I size={16} />}
                </span>
                <span>
                  <strong>{a.label}</strong>
                  <small>{a.blurb}</small>
                </span>
                {active && <span className="dropdown__check">●</span>}
              </button>
            );
          })}
          {user && (
            <>
              <div className="dropdown__sep" />
              <button
                className="dropdown__item"
                onClick={async () => {
                  await logout();
                  setOpen(false);
                  navigate('/login');
                }}
              >
                <span className="role-icon">
                  <LogOut size={16} />
                </span>
                <span>
                  <strong>Sign out</strong>
                  <small>{ROLE_LABEL[user.role]}</small>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ onCartClick }: { onCartClick: () => void }) {
  const { user } = useAuth();
  const { data: cart } = useCart();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const navigate = useNavigate();
  const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="brand" aria-label="UTown home">
          <span className="brand__mark">U</span>
          <span className="brand__name">
            UTown<em>.eats</em>
          </span>
        </Link>

        {isCustomer && <AddressBadge />}

        <form className="search" onSubmit={submit} role="search">
          <Search size={16} />
          <input
            id="header-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search restaurants or dishes"
            aria-label="Search restaurants"
          />
        </form>

        <nav className="header__nav">
          {isCustomer && (
            <NavLink to="/orders" className="nav-link hide-sm">
              Orders
            </NavLink>
          )}
          {user?.role === 'RESTAURANT_OWNER' && <NavLink to="/owner" className="nav-link">Kitchen</NavLink>}
          {user?.role === 'RIDER' && <NavLink to="/rider" className="nav-link">Deliveries</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin" className="nav-link">Dispatch</NavLink>}

          {isCustomer && (
            <button id="cart-button" className="icon-btn icon-btn--cart" onClick={onCartClick} aria-label={`Cart, ${count} items`}>
              <ShoppingBag size={19} />
              {count > 0 && <span key={count} className="cart-count">{count}</span>}
            </button>
          )}
          <DemoSwitcher />
        </nav>
      </div>
    </header>
  );
}
