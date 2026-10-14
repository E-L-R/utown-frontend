import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries } from '@tanstack/react-query';
import { Ban, Bike, Check, ChefHat, CircleDollarSign, Clock, Flame, Inbox, PackageCheck, Timer, UtensilsCrossed } from 'lucide-react';
import { deliveryApi, orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { qk, useInvalidateOrders, useNow, useOrders, useRestaurants, useRestaurantTypes } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { DispatchModal } from '../components/DispatchModal';
import { Art, Badge, ErrorState, LoadingState, Modal, Spinner, Stat, useDocumentTitle } from '../components/ui';
import {
  ACTIVE_ASSIGNMENT,
  ASSIGNMENT_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
  cx,
  formatMoney,
  formatTime,
  minutesSince,
  parseServerDate,
  restaurantArt,
  shortOrderNo,
} from '../lib/format';
import type { DeliveryAssignmentResponse, OrderResponse, OrderStatus } from '../types/api';

const COLUMNS: { key: string; title: string; statuses: OrderStatus[]; color: string; empty: string }[] = [
  { key: 'new', title: 'New', statuses: ['PENDING'], color: 'var(--warn)', empty: 'New orders land here — accept them fast.' },
  { key: 'cooking', title: 'Cooking', statuses: ['ACCEPTED', 'IN_PREPARATION'], color: 'var(--accent)', empty: 'Nothing on the stove.' },
  { key: 'ready', title: 'Ready for pickup', statuses: ['READY_FOR_PICKUP'], color: 'var(--info)', empty: 'Packed orders wait here for a rider.' },
  { key: 'out', title: 'On the road', statuses: ['OUT_FOR_DELIVERY'], color: 'var(--success)', empty: 'No deliveries in flight.' },
];

const isToday = (v?: string | null) => parseServerDate(v)?.toDateString() === new Date().toDateString();

export default function OwnerDashboardPage() {
  useDocumentTitle('Kitchen');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
  const { notify } = useToast();
  const invalidate = useInvalidateOrders();
  const { switchTo, pending: switching } = useSwitchRole();
  const now = useNow(20_000);

  const mine = useMemo(() => restaurants?.filter((r) => isAdmin || r.ownerId === user?.id) ?? [], [restaurants, isAdmin, user?.id]);
  const others = useMemo(() => (isAdmin ? [] : restaurants?.filter((r) => r.ownerId !== user?.id) ?? []), [restaurants, isAdmin, user?.id]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const { data: orders, isPending, error, refetch } = useOrders(restaurantId ? { restaurantId } : {}, { poll: 5_000 });

  const [accepting, setAccepting] = useState<OrderResponse | null>(null);
  const [minutes, setMinutes] = useState(20);
  const [declining, setDeclining] = useState<OrderResponse | null>(null);
  const [reason, setReason] = useState('Kitchen is at capacity right now');
  const [dispatching, setDispatching] = useState<OrderResponse | null>(null);

  const all = useMemo(() => orders ?? [], [orders]);
  const active = all.filter((o) => ['ACCEPTED', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(o.status));

  // Rider status for every order past "accepted".
  const assignmentQueries = useQueries({
    queries: active.map((o) => ({
      queryKey: qk.orderAssignments(o.id),
      queryFn: () => deliveryApi.forOrder(o.id),
      refetchInterval: 6_000,
    })),
  });
  const assignmentFor = (orderId: number): DeliveryAssignmentResponse | undefined => {
    const i = active.findIndex((o) => o.id === orderId);
    const list = i >= 0 ? assignmentQueries[i]?.data : undefined;
    return list?.find((a) => ACTIVE_ASSIGNMENT.includes(a.status)) ?? list?.find((a) => a.status === 'DELIVERED');
  };

  // Announce new tickets.
  const pendingIds = all.filter((o) => o.status === 'PENDING').map((o) => o.id);
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!orders) return;
    if (seen.current) {
      const fresh = pendingIds.filter((id) => !seen.current!.has(id));
      if (fresh.length) notify(fresh.length === 1 ? 'New order just came in' : `${fresh.length} new orders`, 'info');
    }
    seen.current = new Set(pendingIds);
    document.title = pendingIds.length ? `(${pendingIds.length}) Kitchen · UTown` : 'Kitchen · UTown';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds.join(',')]);

  const transition = useMutation({
    mutationFn: async ({ order, to }: { order: OrderResponse; to: 'accept' | 'prepare' | 'ready' | 'decline' }) => {
      switch (to) {
        case 'accept': return orderApi.accept(order.id, minutes);
        case 'prepare': return orderApi.prepare(order.id);
        case 'ready': return orderApi.ready(order.id);
        case 'decline': return orderApi.decline(order.id, reason.trim());
      }
    },
    onSuccess: (updated, { to }) => {
      invalidate(updated);
      notify(
        { accept: 'Accepted — it’s in the cooking queue', prepare: 'Cooking started', ready: 'Marked ready — call a rider when you’re set', decline: 'Order declined' }[to],
        to === 'decline' ? 'info' : 'success',
      );
      setAccepting(null);
      setDeclining(null);
    },
    onError: (e) => notify(getErrorMessage(e, 'Could not update order'), 'error'),
  });
  const busyWith = (o: OrderResponse) => transition.isPending && transition.variables?.order.id === o.id;

  if (isPending || !restaurants) return <LoadingState label="Opening the kitchen…" />;
  if (error) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  const todays = all.filter((o) => isToday(o.createdAt));
  const revenue = todays.filter((o) => !['CANCELLED', 'DECLINED'].includes(o.status)).reduce((s, o) => s + Number(o.totalAmount), 0);
  const prepTimes = all
    .filter((o) => o.acceptedAt && o.readyAt)
    .map((o) => (parseServerDate(o.readyAt)!.getTime() - parseServerDate(o.acceptedAt)!.getTime()) / 60_000);
  const avgPrep = prepTimes.length ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : null;
  const history = all.filter((o) => ['DELIVERED', 'COMPLETED', 'CANCELLED', 'DECLINED'].includes(o.status)).slice(0, 8);
  const nameOf = (id: number) => restaurants.find((r) => r.id === id)?.name ?? `#${id}`;

  const renderActions = (o: OrderResponse) => {
    const busy = busyWith(o);
    switch (o.status) {
      case 'PENDING':
        return (
          <>
            <button className="btn btn--danger btn--sm" onClick={() => setDeclining(o)} id={`decline-order-${o.id}`} aria-label="Decline order"><Ban size={14} /></button>
            <button className="btn btn--primary btn--sm grow" onClick={() => { setMinutes(20); setAccepting(o); }} id={`accept-order-${o.id}`}>
              <Check size={15} /> Accept
            </button>
          </>
        );
      case 'ACCEPTED':
        return (
          <button className="btn btn--primary btn--sm btn--block" disabled={busy} onClick={() => transition.mutate({ order: o, to: 'prepare' })} id={`prepare-order-${o.id}`}>
            {busy ? <Spinner size={14} /> : <><Flame size={15} /> Start cooking</>}
          </button>
        );
      case 'IN_PREPARATION':
        return (
          <button className="btn btn--primary btn--sm btn--block" disabled={busy} onClick={() => transition.mutate({ order: o, to: 'ready' })} id={`ready-order-${o.id}`}>
            {busy ? <Spinner size={14} /> : <><PackageCheck size={15} /> Mark ready</>}
          </button>
        );
      case 'READY_FOR_PICKUP': {
        const a = assignmentFor(o.id);
        return a ? (
          <div className="row small" style={{ width: '100%' }}>
            <Bike size={15} className="accent" />
            <span className="grow truncate"><strong>{a.riderName}</strong> · {ASSIGNMENT_LABEL[a.status].toLowerCase()}</span>
          </div>
        ) : (
          <button className="btn btn--secondary btn--sm btn--block" onClick={() => setDispatching(o)} id={`dispatch-order-${o.id}`}>
            <Bike size={15} /> Call a rider
          </button>
        );
      }
      case 'OUT_FOR_DELIVERY': {
        const a = assignmentFor(o.id);
        return (
          <div className="row small" style={{ width: '100%' }}>
            <Bike size={15} className="accent" />
            <span className="grow truncate">{a ? <><strong>{a.riderName}</strong> since {formatTime(a.pickedUpAt)}</> : 'With the rider'}</span>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><ChefHat size={14} /> Kitchen</span>
          <h1 style={{ marginTop: 6 }}>{restaurantId ? nameOf(restaurantId) : isAdmin ? 'Every kitchen' : mine.length > 1 ? 'All your kitchens' : mine[0]?.name ?? 'Your kitchen'}</h1>
          <p>Live tickets refresh every few seconds. Accept → cook → ready → hand to a rider.</p>
        </div>
        {mine.length > 1 && (
          <div className="restaurant-tabs" role="tablist" aria-label="Restaurant">
            <button role="tab" aria-selected={restaurantId == null} className={cx('restaurant-tab', restaurantId == null && 'is-active')} onClick={() => setRestaurantId(null)} style={{ paddingLeft: 14 }}>
              All
            </button>
            {mine.map((r) => (
              <button key={r.id} role="tab" aria-selected={restaurantId === r.id} className={cx('restaurant-tab', restaurantId === r.id && 'is-active')} onClick={() => setRestaurantId(r.id)}>
                <Art art={restaurantArt(types?.find((t) => t.id === r.typeId)?.name, r.name)} src={r.logoUrl} />
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="stats">
        <Stat icon={<Inbox size={14} />} label="Waiting" value={pendingIds.length} hint={pendingIds.length ? 'Needs a decision' : 'All caught up'} />
        <Stat icon={<Flame size={14} />} label="In the kitchen" value={active.filter((o) => o.status !== 'OUT_FOR_DELIVERY').length} hint="Accepted, cooking or packed" />
        <Stat icon={<CircleDollarSign size={14} />} label="Today's sales" value={formatMoney(revenue)} hint={`${todays.length} orders today`} />
        <Stat icon={<Timer size={14} />} label="Avg. prep" value={avgPrep == null ? '—' : avgPrep < 1 ? '<1 min' : `${Math.round(avgPrep)} min`} hint="Accepted → ready" />
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const list = all.filter((o) => col.statuses.includes(o.status)).sort((a, b) => a.id - b.id);
          return (
            <section key={col.key} className="board__col" aria-label={col.title}>
              <header className="board__head">
                <span className="board__dot" style={{ '--c': col.color } as CSSProperties} />
                {col.title}
                <Badge>{list.length}</Badge>
              </header>
              {list.length === 0 ? (
                <div className="board__empty">{col.empty}</div>
              ) : (
                list.map((o) => {
                  const since = o.status === 'PENDING' ? o.createdAt : o.acceptedAt ?? o.createdAt;
                  const mins = minutesSince(since, now) ?? 0;
                  const target = o.estimatedCookingMinutes ?? 20;
                  const late = (o.status === 'PENDING' && mins >= 5) || (['ACCEPTED', 'IN_PREPARATION'].includes(o.status) && mins > target);
                  return (
                    <article key={o.id} className={cx('ticket', o.status === 'PENDING' && 'ticket--new', late && 'ticket--late')} id={`ticket-${o.id}`}>
                      <div className="row row--between">
                        <span className="row">
                          <strong className="mono">#{shortOrderNo(o.orderNumber)}</strong>
                          {o.status === 'IN_PREPARATION' && <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>}
                        </span>
                        <span className="timer" title={o.status === 'PENDING' ? 'Waiting since placed' : 'Since accepted'}>
                          <Clock size={12} /> {mins}m{['ACCEPTED', 'IN_PREPARATION'].includes(o.status) ? ` / ${target}m` : ''}
                        </span>
                      </div>
                      {(mine.length > 1 || isAdmin) && !restaurantId && <span className="tiny muted strong">{o.restaurantName ?? nameOf(o.restaurantId)}</span>}
                      <ul className="ticket__items">
                        {o.items.map((i) => (
                          <li key={i.id}>
                            <b>{i.quantity}×</b>
                            <span>
                              {i.dishName}
                              {i.options?.length ? <span className="tiny muted" style={{ display: 'block' }}>{i.options.map((x) => x.optionName).join(', ')}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {o.deliveryNote && <div className="ticket__note">“{o.deliveryNote}”</div>}
                      <div className="row row--between tiny muted">
                        <span>{PAYMENT_LABEL[o.paymentMethod]}</span>
                        <strong style={{ color: 'var(--text)' }}>{formatMoney(o.totalAmount)}</strong>
                      </div>
                      <div className="ticket__foot">{renderActions(o)}</div>
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {history.length > 0 && (
        <section className="panel section">
          <header className="panel__head"><h2><UtensilsCrossed size={18} /> Recently finished</h2></header>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Order</th>{(mine.length > 1 || isAdmin) && <th>Restaurant</th>}<th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id}>
                    <td className="mono"><Link to={`/orders/${o.id}`} className="link-btn">#{shortOrderNo(o.orderNumber)}</Link></td>
                    {(mine.length > 1 || isAdmin) && <td>{o.restaurantName ?? nameOf(o.restaurantId)}</td>}
                    <td className="truncate" style={{ maxWidth: 260 }}>{o.items.map((i) => `${i.quantity}× ${i.dishName}`).join(', ')}</td>
                    <td>{formatMoney(o.totalAmount)}</td>
                    <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                    <td className="muted">{formatTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="section">
          <p className="small muted" style={{ marginBottom: 10 }}>Other kitchens in this demo are run by a second owner account:</p>
          <div className="restaurant-tabs">
            {others.map((r) => (
              <button key={r.id} className="restaurant-tab" disabled={switching !== null} onClick={() => switchTo('RESTAURANT_OWNER', '/kitchen', { userId: r.ownerId })}>
                <Art art={restaurantArt(types?.find((t) => t.id === r.typeId)?.name, r.name)} src={r.logoUrl} />
                {r.name}
                {switching ? <Spinner size={14} /> : <span className="muted small">Open →</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={Boolean(accepting)}
        onClose={() => setAccepting(null)}
        title={`Accept #${shortOrderNo(accepting?.orderNumber)}`}
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setAccepting(null)}>Back</button>
            <button className="btn btn--primary grow" disabled={transition.isPending} onClick={() => accepting && transition.mutate({ order: accepting, to: 'accept' })}>
              {transition.isPending ? <Spinner size={16} /> : `Accept · ready in ${minutes} min`}
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 14 }}>How long will the kitchen need? The customer sees this as their ETA.</p>
        <div className="chips" style={{ marginBottom: 14 }}>
          {[10, 15, 20, 30, 45].map((m) => (
            <button key={m} type="button" className={cx('chip-btn', minutes === m && 'is-active')} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        <label className="field">
          <span>Custom (minutes)</span>
          <input className="input" type="number" min={5} max={120} value={minutes} onChange={(e) => setMinutes(Math.min(120, Math.max(5, Number(e.target.value) || 5)))} />
        </label>
      </Modal>

      <Modal
        open={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title="Decline this order?"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setDeclining(null)}>Keep it</button>
            <button className="btn btn--danger grow" disabled={transition.isPending || !reason.trim()} onClick={() => declining && transition.mutate({ order: declining, to: 'decline' })}>
              {transition.isPending ? <Spinner size={16} /> : 'Decline order'}
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 14 }}>The customer sees this reason and any payment is refunded.</p>
        <div className="chips" style={{ marginBottom: 12 }}>
          {['Kitchen is at capacity right now', 'An item is sold out', 'Closing soon'].map((r) => (
            <button key={r} type="button" className={cx('chip-btn', reason === r && 'is-active')} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        <label className="field">
          <span>Reason</span>
          <textarea className="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
      </Modal>

      <DispatchModal order={dispatching} onClose={() => setDispatching(null)} />
    </div>
  );
}
