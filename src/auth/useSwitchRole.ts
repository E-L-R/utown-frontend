import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import { getErrorMessage } from '../api/client';
import { ROLE_HOME, ROLE_LABEL } from '../lib/format';
import type { UserProfileResponse, UserRole } from '../types/api';

const normalize = (p?: string | null) => (p ?? '').replace(/\D/g, '').replace(/^82/, '0');

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
type LastOrder = { id: number; restaurantId: number; ownerId?: number; riderUserId?: number };
export function rememberLastOrder(order: LastOrder) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* not persisted */
  }
}
/** Record which rider got the job, so the tour can sign in as them. */
export function rememberDispatch(orderId: number, riderUserId: number) {
  const prev = lastOrder();
  if (prev?.id === orderId) rememberLastOrder({ ...prev, riderUserId });
}
export function lastOrder(): LastOrder | null {
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

  /**
   * `userId` picks the demo account with that user id (e.g. the owner of a restaurant, or the rider
   * a job went to); `phone` picks one account directly. Otherwise the role's default account is used.
   */
  const switchTo = async (role: UserRole, to?: string, opts: { userId?: number; phone?: string } = {}) => {
    const wantId = opts.userId;
    const sameAccount = opts.phone ? normalize(user?.phone) === opts.phone : wantId == null || user?.id === wantId;
    if (user?.role === role && sameAccount) {
      navigate(to ?? ROLE_HOME[role]);
      return true;
    }

    const ids = readIds();
    let candidates = DEMO_ACCOUNTS.filter((a) => a.role === role);
    if (opts.phone) {
      candidates = candidates.filter((a) => a.phone === opts.phone);
    } else if (wantId != null) {
      // Known match first, unknown ids next; known mismatches are skipped.
      const rank = (phone: string) => (ids[phone] === wantId ? 0 : 1);
      candidates = candidates.filter((a) => ids[a.phone] == null || ids[a.phone] === wantId).sort((a, b) => rank(a.phone) - rank(b.phone));
    } else {
      candidates = candidates.filter((a) => !a.hidden);
    }

    setPending(role);
    try {
      let me: UserProfileResponse | null = null;
      for (const acct of candidates) {
        me = await login(acct.phone, acct.password);
        rememberId(acct.phone, me.id);
        if (wantId == null || opts.phone || me.id === wantId) break;
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
