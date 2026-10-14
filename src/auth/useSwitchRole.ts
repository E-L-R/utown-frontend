import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import { getErrorMessage } from '../api/client';
import { ROLE_HOME, ROLE_LABEL } from '../lib/format';
import type { UserProfileResponse, UserRole } from '../types/api';

/** user id per demo phone, learned on sign-in, so we can pick "the owner of restaurant X". */
const IDS_KEY = 'utown.demoIds';
function readIds(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(IDS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function rememberId(phone: string, id: number) {
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify({ ...readIds(), [phone]: id }));
  } catch {
    /* not persisted */
  }
}

/** The most recent order placed in this browser, so the tour can open the right kitchen. */
const LAST_ORDER_KEY = 'utown.lastOrder';
export function rememberLastOrder(order: { id: number; restaurantId: number; ownerId?: number }) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* not persisted */
  }
}
export function lastOrder(): { id: number; restaurantId: number; ownerId?: number } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** One-click sign-in as a seeded demo account, then land on that role's home (or `to`). */
export function useSwitchRole() {
  const { user, login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [pending, setPending] = useState<UserRole | null>(null);

  /** `ownerId` picks the demo owner of a specific restaurant when there are several. */
  const switchTo = async (role: UserRole, to?: string, opts: { ownerId?: number } = {}) => {
    const wantOwner = role === 'RESTAURANT_OWNER' && opts.ownerId != null;
    if (user?.role === role && (!wantOwner || user.id === opts.ownerId)) {
      navigate(to ?? ROLE_HOME[role]);
      return true;
    }

    const ids = readIds();
    let candidates = DEMO_ACCOUNTS.filter((a) => a.role === role);
    if (wantOwner) {
      // Known match first, unknown ids next, known mismatches last.
      const rank = (phone: string) => (ids[phone] === opts.ownerId ? 0 : ids[phone] == null ? 1 : 2);
      candidates = [...candidates].sort((a, b) => rank(a.phone) - rank(b.phone));
    } else {
      candidates = candidates.filter((a) => !a.hidden);
    }

    setPending(role);
    try {
      let me: UserProfileResponse | null = null;
      for (const acct of candidates) {
        if (wantOwner && ids[acct.phone] != null && ids[acct.phone] !== opts.ownerId) continue;
        me = await login(acct.phone, acct.password);
        rememberId(acct.phone, me.id);
        if (!wantOwner || me.id === opts.ownerId) break;
      }
      if (!me) throw new Error('No demo account for that role');
      notify(`You're now the ${ROLE_LABEL[me.role].toLowerCase()} — ${me.name}`, 'success');
      navigate(to ?? ROLE_HOME[me.role]);
      return true;
    } catch (e) {
      notify(getErrorMessage(e, 'Could not switch role'), 'error');
      return false;
    } finally {
      setPending(null);
    }
  };

  return { switchTo, pending };
}
