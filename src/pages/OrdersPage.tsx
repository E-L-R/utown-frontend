import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, ShoppingBag, Utensils } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useOrders, useRestaurants } from '../hooks/queries';
import { Badge, EmptyState, ErrorState, LoadingState, SmartImage } from '../components/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  TERMINAL_STATUSES,
  formatDateTime,
  formatMoney,
} from '../lib/format';

export default function OrdersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  const { data: orders, isPending, error, refetch } = useOrders(
    { userId: user?.id },
    { enabled: Boolean(user?.id), poll: 12_000 }
  );
  const { data: restaurants } = useRestaurants();

  if (isPending) return <LoadingState label="Loading your orders…" />;
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const allOrders = orders ?? [];
  const filtered = allOrders.filter((order) => {
    const isFinished = TERMINAL_STATUSES.includes(order.status);
    if (tab === 'ACTIVE') return !isFinished;
    if (tab === 'COMPLETED') return isFinished;
    return true;
  });

  const getRestName = (restId: number) => {
    const r = restaurants?.find((x) => x.id === restId);
    return r?.name ?? `Restaurant #${restId}`;
  };

  const getRestImg = (restId: number) => {
    const r = restaurants?.find((x) => x.id === restId);
    return r?.logoUrl;
  };

  return (
    <div className="container section orders-history-page">
      <div className="section-head row-between flex-wrap gap-md">
        <div>
          <h1>Your Orders</h1>
          <p className="muted">Track live deliveries and view past meals</p>
        </div>

        <div className="chips">
          <button
            className={`chip-btn ${tab === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setTab('ALL')}
          >
            All ({allOrders.length})
          </button>
          <button
            className={`chip-btn ${tab === 'ACTIVE' ? 'is-active' : ''}`}
            onClick={() => setTab('ACTIVE')}
          >
            Active (
            {allOrders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length}
            )
          </button>
          <button
            className={`chip-btn ${tab === 'COMPLETED' ? 'is-active' : ''}`}
            onClick={() => setTab('COMPLETED')}
          >
            Completed (
            {allOrders.filter((o) => TERMINAL_STATUSES.includes(o.status)).length}
            )
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={32} />}
          title={tab === 'ALL' ? 'No orders yet' : `No ${tab.toLowerCase()} orders`}
        >
          <p className="mb-md">When you place an order, you can follow its live preparation and delivery right here.</p>
          <Link to="/" className="btn btn--primary">
            <Utensils size={16} /> Explore Menus
          </Link>
        </EmptyState>
      ) : (
        <div className="orders-list flex-col gap-md">
          {filtered.map((order) => {
            const restName = getRestName(order.restaurantId);
            const isLive = !TERMINAL_STATUSES.includes(order.status);
            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className={`card order-card ${isLive ? 'order-card--live' : ''}`}
              >
                <div className="order-card__header row-between flex-wrap gap-sm">
                  <div className="row items-center gap-md">
                    <SmartImage
                      src={getRestImg(order.restaurantId)}
                      alt={restName}
                      hints={[restName]}
                      className="order-card__avatar"
                    />
                    <div>
                      <h3 className="font-semibold text-base">{restName}</h3>
                      <div className="muted text-xs row items-center gap-xs">
                        <Clock size={12} />
                        <span>Order #{order.orderNumber.slice(-8)}</span>
                        <span>•</span>
                        <span>
                          {order.acceptedAt
                            ? formatDateTime(order.acceptedAt)
                            : 'Order in progress'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="row items-center gap-sm">
                    <Badge tone={ORDER_STATUS_TONE[order.status]} dot>
                      {ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                  </div>
                </div>

                <div className="order-card__body mt-sm">
                  <div className="order-card__items muted text-sm">
                    {order.items
                      .map((i) => `${i.quantity}× ${i.dishName}`)
                      .join(', ')}
                  </div>
                </div>

                <div className="order-card__footer row-between items-center mt-md pt-sm border-t">
                  <div className="row items-center gap-md">
                    <span className="font-bold text-accent">
                      {formatMoney(order.totalAmount)}
                    </span>
                    <span className="muted text-xs">
                      {order.items.reduce((acc, i) => acc + i.quantity, 0)} items
                    </span>
                  </div>

                  <span className="row items-center gap-xs text-sm font-semibold text-accent hover-underline">
                    {isLive ? 'Track Live Order' : 'View Details'}
                    <ChevronRight size={16} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
