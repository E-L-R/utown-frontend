import { Ban, Bike, ChefHat, CircleCheck, Clock, Package, Receipt, ThumbsUp } from 'lucide-react';
import type { OrderResponse, OrderStatus } from '../types/api';
import { ORDER_FLOW, ORDER_STATUS_LABEL, cx, formatDateTime } from '../lib/format';

const STEP_ICON: Record<string, typeof Clock> = {
  PENDING: Receipt,
  ACCEPTED: ThumbsUp,
  IN_PREPARATION: ChefHat,
  READY_FOR_PICKUP: Package,
  OUT_FOR_DELIVERY: Bike,
  DELIVERED: CircleCheck,
};

function timestampFor(order: OrderResponse, s: OrderStatus): string | null | undefined {
  switch (s) {
    case 'ACCEPTED': return order.acceptedAt;
    case 'READY_FOR_PICKUP': return order.readyAt;
    case 'OUT_FOR_DELIVERY': return order.pickedUpAt;
    case 'DELIVERED': return order.deliveredAt;
    default: return null;
  }
}

export function OrderStepper({ order }: { order: OrderResponse }) {
  if (order.status === 'CANCELLED' || order.status === 'DECLINED') {
    return (
      <div className="stepper-halt">
        <Ban size={22} />
        <div>
          <strong>Order {ORDER_STATUS_LABEL[order.status].toLowerCase()}</strong>
          <p className="muted small">
            {order.rejectionReason || 'This order will not be delivered.'}
            {order.cancelledAt && ` · ${formatDateTime(order.cancelledAt)}`}
          </p>
        </div>
      </div>
    );
  }

  const effective: OrderStatus = order.status === 'COMPLETED' ? 'DELIVERED' : order.status;
  const current = ORDER_FLOW.indexOf(effective);
  const pct = (Math.max(0, current) / (ORDER_FLOW.length - 1)) * 100;

  return (
    <div className="order-stepper">
      <div className="order-stepper__track">
        <span className="order-stepper__fill" style={{ width: `${pct}%` }} />
      </div>
      <ol>
        {ORDER_FLOW.map((s, i) => {
          const Icon = STEP_ICON[s];
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const ts = timestampFor(order, s);
          return (
            <li key={s} className={cx('step', `step--${state}`)}>
              <span className="step__dot">
                <Icon size={16} />
              </span>
              <span className="step__label">{ORDER_STATUS_LABEL[s]}</span>
              {ts && <span className="step__time">{formatDateTime(ts)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
