import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Bike, Clock, MapPin, MessageSquare, RotateCcw, Star, Store, Wallet } from 'lucide-react';
import { orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  qk,
  useInvalidateOrders,
  useNow,
  useOrder,
  useOrderAssignments,
  useRatings,
  useReorder,
  useRestaurants,
  useRestaurantTypes,
} from '../hooks/queries';
import { useToast } from '../components/Toast';
import { useCartDrawer } from '../components/Layout';
import { ProgressBar, Timeline, statusIcon } from '../components/OrderProgress';
import { Art, Badge, ErrorState, LoadingState, Modal, Spinner, Stars, StatusBadge, useDocumentTitle } from '../components/ui';
import {
  ASSIGNMENT_LABEL,
  ASSIGNMENT_TONE,
  ORDER_STATUS_COPY,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
  ROLE_HOME,
  TRANSPORT_LABEL,
  cx,
  formatDateTime,
  formatMoney,
  formatTime,
  initials,
  isLiveOrder,
  parseServerDate,
  restaurantArt,
  shortOrderNo,
} from '../lib/format';
import type { OrderResponse, RatingRequest } from '../types/api';

/** Rough ETA: cooking estimate + a ride, or the restaurant's quoted delivery time. */
function estimateArrival(order: OrderResponse, quotedMinutes = 30): Date | null {
  const at = (v?: string | null, plus = 0) => {
    const d = parseServerDate(v);
    return d ? new Date(d.getTime() + plus * 60_000) : null;
  };
  if (order.pickedUpAt) return at(order.pickedUpAt, 12);
  if (order.readyAt) return at(order.readyAt, 18);
  if (order.acceptedAt) return at(order.acceptedAt, (order.estimatedCookingMinutes ?? 20) + 15);
  return at(order.createdAt, quotedMinutes);
}

export default function OrderTrackingPage() {
  const orderId = Number(useParams().id);
  const { data: order, isPending, error, refetch } = useOrder(orderId);
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
  const { user } = useAuth();
  const assignments = useOrderAssignments(order);
  const ratings = useRatings(order?.restaurantId ?? NaN);
  const { notify } = useToast();
  const invalidateOrders = useInvalidateOrders();
  const reorder = useReorder();
  const drawer = useCartDrawer();
  const qc = useQueryClient();
  const now = useNow(15_000);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [rateOpen, setRateOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');

  useDocumentTitle(order ? `Order ${shortOrderNo(order.orderNumber)}` : 'Order');

  const cancelMutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId, cancelReason.trim() || 'Cancelled by customer'),
    onSuccess: (updated) => {
      invalidateOrders(updated);
      notify('Order cancelled', 'info');
      setCancelOpen(false);
    },
    onError: (err) => notify(getErrorMessage(err, 'Could not cancel this order'), 'error'),
  });

  const rateMutation = useMutation({
    mutationFn: (body: RatingRequest) => orderApi.rate(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ratings(order!.restaurantId) });
      qc.invalidateQueries({ queryKey: qk.restaurants });
      notify('Thanks — your review is live on the restaurant page.', 'success');
      setRateOpen(false);
    },
    onError: (err) => notify(getErrorMessage(err, 'Could not submit rating'), 'error'),
  });

  if (isPending) return <LoadingState label="Fetching your order…" />;
  if (error || !order) {
    return (
      <div className="container page">
        <ErrorState error={error ?? new Error('Order not found')} onRetry={refetch} />
      </div>
    );
  }

  const restaurant = restaurants?.find((r) => r.id === order.restaurantId);
  const cuisine = types?.find((t) => t.id === restaurant?.typeId)?.name;
  const restaurantName = order.restaurantName ?? restaurant?.name ?? `Restaurant #${order.restaurantId}`;
  const isCustomer = user?.role === 'CUSTOMER';
  const live = isLiveOrder(order.status);
  const delivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const myRating = ratings.data?.find((r) => r.orderId === order.id);
  const assignment = assignments.data?.find((a) => a.status !== 'CANCELLED') ?? assignments.data?.[0];

  const [headline, subline] = ORDER_STATUS_COPY[order.status];
  const Icon = statusIcon(order.status);
  const tone = ORDER_STATUS_TONE[order.status];
  const eta = live ? estimateArrival(order, restaurant?.deliveryTimeMinutes) : null;
  const etaMinutes = eta ? Math.max(1, Math.round((eta.getTime() - now) / 60_000)) : null;
  const backTo = isCustomer ? '/orders' : user ? ROLE_HOME[user.role] : '/';

  return (
    <div className="container page">
      <Link to={backTo} className="back-link"><ArrowLeft size={16} /> {isCustomer ? 'All orders' : 'Back'}</Link>

      <section className={cx('track-hero', `tone--${tone}`)} aria-live="polite">
        <div className="track-hero__top">
          <span className={cx('track-hero__icon', live && 'is-live')}><Icon size={32} /></span>
          <div className="grow" style={{ minWidth: 220 }}>
            <div className="row row--wrap" style={{ marginBottom: 6 }}>
              <StatusBadge status={order.status} />
              <span className="mono muted small">#{shortOrderNo(order.orderNumber)}</span>
            </div>
            <h1>{headline}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{order.status === 'DECLINED' && order.rejectionReason ? `“${order.rejectionReason}”` : subline}</p>
          </div>
          {eta && (
            <div className="track-hero__eta">
              <span>Arriving around</span>
              <strong>{eta.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</strong>
              <span style={{ textTransform: 'none', letterSpacing: 0 }}>in about {etaMinutes} min</span>
            </div>
          )}
          {delivered && order.deliveredAt && (
            <div className="track-hero__eta">
              <span>Delivered at</span>
              <strong>{formatTime(order.deliveredAt)}</strong>
            </div>
          )}
        </div>

        {order.status !== 'CANCELLED' && order.status !== 'DECLINED' && <ProgressBar order={order} />}

        <div className="row row--wrap" style={{ marginTop: 22, gap: 10 }}>
          {isCustomer && order.status === 'PENDING' && (
            <button className="btn btn--danger btn--sm" onClick={() => setCancelOpen(true)} id="cancel-order-button">
              <Ban size={15} /> Cancel order
            </button>
          )}
          {isCustomer && delivered && !myRating && (
            <button className="btn btn--primary btn--sm" onClick={() => setRateOpen(true)} id="rate-order-button">
              <Star size={15} /> Rate this order
            </button>
          )}
          {isCustomer && myRating && (
            <span className="chip"><Stars value={myRating.score} size={12} /> You rated this order</span>
          )}
          {isCustomer && !live && (
            <button
              className="btn btn--secondary btn--sm"
              disabled={reorder.isPending}
              onClick={() =>
                reorder.mutate(order, {
                  onSuccess: ({ skipped }) => {
                    notify(skipped ? `Added to your bag — ${skipped} item(s) are no longer available.` : 'Added to your bag', 'success');
                    drawer.open();
                  },
                  onError: (e) => notify(getErrorMessage(e, 'Could not reorder'), 'error'),
                })
              }
            >
              {reorder.isPending ? <Spinner size={15} /> : <RotateCcw size={15} />} Order again
            </button>
          )}
          <Link to={`/restaurant/${order.restaurantId}`} className="btn btn--ghost btn--sm"><Store size={15} /> {restaurantName}</Link>
        </div>
      </section>

      <div className="track-grid">
        <div className="stack">
          {(assignment || (live && order.status !== 'PENDING')) && (
            <section className="panel" aria-label="Delivery">
              <header className="panel__head"><h2><Bike size={18} /> Your rider</h2></header>
              {assignment ? (
                <div className="rider-card">
                  <span className="avatar avatar--lg role--rider">{initials(assignment.riderName)}</span>
                  <span className="grow">
                    <strong style={{ display: 'block' }}>{assignment.riderName ?? `Rider #${assignment.riderId}`}</strong>
                    <span className="small muted">
                      {assignment.transportType ? TRANSPORT_LABEL[assignment.transportType] : 'Courier'}
                      {assignment.pickedUpAt ? ` · picked up ${formatTime(assignment.pickedUpAt)}` : assignment.acceptedAt ? ` · accepted ${formatTime(assignment.acceptedAt)}` : ''}
                    </span>
                  </span>
                  <Badge tone={ASSIGNMENT_TONE[assignment.status]} dot live={assignment.status !== 'DELIVERED'}>{ASSIGNMENT_LABEL[assignment.status]}</Badge>
                </div>
              ) : (
                <div className="rider-card">
                  <span className="avatar avatar--lg" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}><Spinner size={18} /></span>
                  <span className="grow">
                    <strong style={{ display: 'block' }}>Finding a rider nearby</strong>
                    <span className="small muted">We'll assign one while the kitchen cooks.</span>
                  </span>
                </div>
              )}
            </section>
          )}

          <section className="panel" aria-label="Receipt">
            <header className="panel__head">
              <h2><Art art={restaurantArt(cuisine, restaurantName)} style={{ width: 30, height: 30, borderRadius: 6, '--art-size': '16px' } as CSSProperties} /> {restaurantName}</h2>
              <span className="small muted">{order.items.reduce((n, i) => n + i.quantity, 0)} items</span>
            </header>
            <ul style={{ listStyle: 'none' }}>
              {order.items.map((item) => (
                <li key={item.id} className="receipt-item">
                  <span className="receipt-item__qty">{item.quantity}×</span>
                  <span>
                    <strong>{item.dishName}</strong>
                    {item.options && item.options.length > 0 && (
                      <span className="small muted" style={{ display: 'block' }}>
                        {item.options.map((o) => `${o.optionName}${o.optionPrice ? ` (+${formatMoney(o.optionPrice)})` : ''}`).join(', ')}
                      </span>
                    )}
                  </span>
                  <span>{formatMoney(item.subTotal ?? item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="totals" style={{ marginTop: 12 }}>
              <div className="totals__row"><span>Subtotal</span><span>{formatMoney(order.subTotal)}</span></div>
              <div className="totals__row"><span>Delivery</span><span>{Number(order.deliveryFee) ? formatMoney(order.deliveryFee) : 'Free'}</span></div>
              <div className="totals__row totals__row--total"><span>Total</span><span>{formatMoney(order.totalAmount)}</span></div>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="panel" aria-label="Timeline">
            <header className="panel__head"><h2><Clock size={18} /> Timeline</h2></header>
            <Timeline order={order} />
          </section>

          <section className="panel" aria-label="Details">
            <div className="kv">
              <div className="kv__row">
                <span className="kv__icon"><MapPin size={17} /></span>
                <span>
                  <span className="kv__label">Delivering to</span>
                  <span className="kv__value" style={{ display: 'block' }}>{order.deliveryAddress ?? `Saved address #${order.addressId}`}</span>
                </span>
              </div>
              {order.deliveryNote && (
                <div className="kv__row">
                  <span className="kv__icon"><MessageSquare size={17} /></span>
                  <span>
                    <span className="kv__label">Note for rider</span>
                    <span className="kv__value" style={{ display: 'block' }}>“{order.deliveryNote}”</span>
                  </span>
                </div>
              )}
              <div className="kv__row">
                <span className="kv__icon"><Wallet size={17} /></span>
                <span className="grow">
                  <span className="kv__label">Payment</span>
                  <span className="kv__value row" style={{ justifyContent: 'space-between' }}>
                    {PAYMENT_LABEL[order.paymentMethod]}
                    <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'REFUNDED' ? 'info' : 'warn'}>
                      {order.paymentStatus.charAt(0) + order.paymentStatus.slice(1).toLowerCase()}
                    </Badge>
                  </span>
                </span>
              </div>
              <div className="kv__row">
                <span className="kv__icon"><Clock size={17} /></span>
                <span>
                  <span className="kv__label">Placed</span>
                  <span className="kv__value" style={{ display: 'block' }}>{formatDateTime(order.createdAt)}</span>
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setCancelOpen(false)}>Keep order</button>
            <button className="btn btn--danger grow" disabled={cancelMutation.isPending || !cancelReason.trim()} onClick={() => cancelMutation.mutate()}>
              {cancelMutation.isPending ? <Spinner size={16} /> : 'Cancel order'}
            </button>
          </>
        }
      >
        <p className="muted" style={{ marginBottom: 14 }}>You can cancel until the restaurant accepts. Any payment is refunded automatically.</p>
        <label className="field">
          <span>Reason</span>
          <textarea className="textarea" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
        </label>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title={`How was ${restaurantName}?`}
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setRateOpen(false)}>Later</button>
            <button
              className="btn btn--primary grow"
              disabled={rateMutation.isPending}
              onClick={() => rateMutation.mutate({ score, comment: comment.trim() || undefined })}
            >
              {rateMutation.isPending ? <Spinner size={16} /> : 'Post review'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ alignItems: 'center', padding: '8px 0 4px' }}>
          <div className="rate-stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" role="radio" aria-checked={score === v} className={cx(score >= v && 'is-on')} onClick={() => setScore(v)} aria-label={`${v} star${v > 1 ? 's' : ''}`}>
                <Star size={38} fill="currentColor" />
              </button>
            ))}
          </div>
          <strong>{['', 'Not great', 'Could be better', 'Good', 'Really good', 'Outstanding'][score]}</strong>
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Tell others about it (optional)</span>
          <textarea className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Was it hot? On time? What should people order?" />
        </label>
      </Modal>
    </div>
  );
}
