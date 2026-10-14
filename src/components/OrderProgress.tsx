import { Ban, Bike, ChefHat, CircleCheck, Package, Receipt, ThumbsUp } from 'lucide-react';
import type { OrderResponse, OrderStatus } from '../types/api';
import { ORDER_FLOW, ORDER_STEP_LABEL, cx, formatTime } from '../lib/format';

const STEP_ICON: Record<string, typeof Receipt> = {
  PENDING: Receipt,
  ACCEPTED: ThumbsUp,
  IN_PREPARATION: ChefHat,
  READY_FOR_PICKUP: Package,
  OUT_FOR_DELIVERY: Bike,
  DELIVERED: CircleCheck,
};

export const statusIcon = (s: OrderStatus) => (s === 'CANCELLED' || s === 'DECLINED' ? Ban : STEP_ICON[s === 'COMPLETED' ? 'DELIVERED' : s]);

export function stepTimestamp(order: OrderResponse, s: OrderStatus): string | null | undefined {
  switch (s) {
    case 'PENDING': return order.createdAt;
    case 'ACCEPTED': return order.acceptedAt;
    case 'READY_FOR_PICKUP': return order.readyAt;
    case 'OUT_FOR_DELIVERY': return order.pickedUpAt;
    case 'DELIVERED': return order.deliveredAt;
    default: return null;
  }
}

/** 0..1 position of an order along the happy path. */
export function orderProgress(status: OrderStatus): number {
  const effective = status === 'COMPLETED' ? 'DELIVERED' : status;
  const i = ORDER_FLOW.indexOf(effective);
  return i < 0 ? 0 : i / (ORDER_FLOW.length - 1);
}

function currentIndex(order: OrderResponse) {
  return ORDER_FLOW.indexOf(order.status === 'COMPLETED' ? 'DELIVERED' : order.status);
}

export function ProgressBar({ order }: { order: OrderResponse }) {
  const current = currentIndex(order);
  const done = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  // Nudge the fill a little past the current step so it reads as "in progress".
  const pct = done ? 100 : Math.min(100, (current / (ORDER_FLOW.length - 1)) * 100 + 6);
  return (
    <div className="progress" aria-label="Order progress">
      <div className="progress__bar">
        <div className={cx('progress__fill', !done && 'is-live')} style={{ width: `${pct}%` }} />
      </div>
      <ol className="progress__steps" style={{ listStyle: 'none' }}>
        {ORDER_FLOW.map((s, i) => {
          const ts = stepTimestamp(order, s);
          return (
            <li key={s} className={cx('progress__step', i < current && 'is-done', i === current && !done && 'is-current', done && 'is-done')}>
              <span>{ORDER_STEP_LABEL[s]}</span>
              {ts && i <= current && <time>{formatTime(ts)}</time>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Timeline({ order }: { order: OrderResponse }) {
  if (order.status === 'CANCELLED' || order.status === 'DECLINED') {
    return (
      <ol className="timeline">
        <li className="is-done">
          <span className="timeline__dot"><Receipt size={13} /></span>
          <span className="timeline__label">Order placed</span>
          <time>{formatTime(order.createdAt)}</time>
        </li>
        <li className="is-current">
          <span className="timeline__dot"><Ban size={13} /></span>
          <span>
            <span className="timeline__label">{order.status === 'DECLINED' ? 'Declined by restaurant' : 'Cancelled'}</span>
            {order.rejectionReason && <p className="small muted">“{order.rejectionReason}”</p>}
          </span>
          <time>{formatTime(order.cancelledAt ?? order.rejectedAt)}</time>
        </li>
      </ol>
    );
  }
  const current = currentIndex(order);
  const done = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  return (
    <ol className="timeline">
      {ORDER_FLOW.map((s, i) => {
        const Icon = STEP_ICON[s];
        const state = i < current || done ? 'is-done' : i === current ? 'is-current' : 'is-todo';
        const ts = stepTimestamp(order, s);
        return (
          <li key={s} className={state}>
            <span className="timeline__dot"><Icon size={13} /></span>
            <span className="timeline__label">{ORDER_STEP_LABEL[s]}</span>
            {ts && state !== 'is-todo' && <time>{formatTime(ts)}</time>}
          </li>
        );
      })}
    </ol>
  );
}
