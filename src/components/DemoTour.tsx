import { useState } from 'react';
import { Check, ChevronDown, Route } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { lastOrder, useSwitchRole } from '../auth/useSwitchRole';
import { cx } from '../lib/format';
import { ROLE_ICON } from './Header';
import { Spinner } from './ui';
import type { UserRole } from '../types/api';

const STEPS: { role: UserRole; title: string; body: string; to: string }[] = [
  { role: 'CUSTOMER', title: '1 · Order as a customer', body: 'Pick a restaurant, customise a dish, check out.', to: '/' },
  { role: 'RESTAURANT_OWNER', title: '2 · Cook it in the kitchen', body: 'Accept the ticket, start cooking, mark it ready, call a rider.', to: '/kitchen' },
  { role: 'RIDER', title: '3 · Deliver it as the rider', body: 'Accept the job, pick up, hand it over.', to: '/rider' },
  { role: 'CUSTOMER', title: '4 · Track and rate it', body: 'Watch every step land live, then leave a review.', to: '/orders' },
];

const KEY = 'utown.tour.collapsed';

/** Floating guide that lets a visitor play every role in one order's lifecycle. */
export function DemoTour() {
  const { user } = useAuth();
  const { switchTo, pending } = useSwitchRole();
  // First visit: open on wide screens, where it doesn't cover content; a pill otherwise.
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return saved !== '1';
    } catch {
      /* fall through */
    }
    return window.innerWidth >= 1360;
  });
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? '0' : '1');
    } catch {
      /* not persisted */
    }
  };

  const RoleIcon = user ? ROLE_ICON[user.role] : Route;

  if (!open) {
    return (
      <div className="tour">
        <button className="tour__pill" onClick={() => toggle(true)} aria-expanded={false}>
          <span className={cx('role-icon', user && `role--${user.role.toLowerCase()}`)}>
            <RoleIcon size={16} />
          </span>
          <span className="hide-xs">Demo tour</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tour">
      <section className="tour__panel" aria-label="Demo tour">
        <header className="tour__head">
          <span className="role-icon">
            <Route size={18} />
          </span>
          <div className="grow">
            <strong>Play every side of an order</strong>
            <p className="small muted">This is a live demo. Each step signs you in as a different seeded account.</p>
          </div>
          <button className="icon-btn icon-btn--sm" onClick={() => toggle(false)} aria-label="Collapse demo tour">
            <ChevronDown size={18} />
          </button>
        </header>
        <ol className="tour__steps">
          {STEPS.map((s, i) => {
            const Icon = ROLE_ICON[s.role];
            // The customer appears twice; only highlight their first step.
            const here = user?.role === s.role && i !== STEPS.length - 1;
            return (
              <li key={s.title}>
                <button
                  className={cx('tour-step', here && 'is-active')}
                  disabled={pending !== null}
                  onClick={async () => {
                    setPendingStep(i);
                    const recent = lastOrder();
                    if (s.role === 'RESTAURANT_OWNER') await switchTo(s.role, s.to, { userId: recent?.ownerId });
                    else if (s.role === 'RIDER') await switchTo(s.role, s.to, { userId: recent?.riderUserId });
                    else if (i === STEPS.length - 1 && recent) await switchTo(s.role, `/orders/${recent.id}`);
                    else await switchTo(s.role, s.to);
                    setPendingStep(null);
                  }}
                >
                  <span className={cx('role-icon', `role--${s.role.toLowerCase()}`)}>
                    {pendingStep === i ? <Spinner size={16} /> : <Icon size={17} />}
                  </span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.body}</small>
                  </span>
                  {here && <Check size={16} className="accent" />}
                </button>
              </li>
            );
          })}
        </ol>
        <footer className="tour__foot">Orders, tickets and jobs are real API calls against the Spring Boot backend.</footer>
      </section>
    </div>
  );
}
