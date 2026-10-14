import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt, RotateCcw, Utensils } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useOrders, useReorder, useRestaurants, useRestaurantTypes } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { useCartDrawer } from '../components/Layout';
import { orderProgress } from '../components/OrderProgress';
import { Art, EmptyState, ErrorState, LoadingState, Segmented, Spinner, StatusBadge, useDocumentTitle } from '../components/ui';
import { ORDER_STATUS_COPY, formatDay, formatMoney, formatTime, isLiveOrder, restaurantArt, shortOrderNo } from '../lib/format';
import { getErrorMessage } from '../api/client';
import type { OrderResponse } from '../types/api';

type Tab = 'ALL' | 'DELIVERED' | 'CANCELLED';

export default function OrdersPage() {
  useDocumentTitle('Your orders');
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('ALL');
  const { data: orders, isPending, error, refetch } = useOrders({ userId: user?.id }, { enabled: Boolean(user?.id), poll: 10_000 });
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
  const reorder = useReorder();
  const drawer = useCartDrawer();
  const { notify } = useToast();

  if (isPending) return <LoadingState label="Loading your orders…" />;
  if (error) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  const all = orders ?? [];
  const live = all.filter((o) => isLiveOrder(o.status));
  const past = all.filter((o) => !isLiveOrder(o.status));
  const shown = past.filter((o) =>
    tab === 'ALL' ? true : tab === 'DELIVERED' ? o.status === 'DELIVERED' || o.status === 'COMPLETED' : o.status === 'CANCELLED' || o.status === 'DECLINED',
  );

  const info = (o: OrderResponse) => {
    const r = restaurants?.find((x) => x.id === o.restaurantId);
    const name = o.restaurantName ?? r?.name ?? `Restaurant #${o.restaurantId}`;
    return { name, art: restaurantArt(types?.find((t) => t.id === r?.typeId)?.name, name), logo: r?.logoUrl };
  };

  const doReorder = (o: OrderResponse) =>
    reorder.mutate(o, {
      onSuccess: ({ skipped }) => {
        notify(skipped ? `Added to your bag — ${skipped} item(s) are no longer available.` : 'Added to your bag', 'success');
        drawer.open();
      },
      onError: (e) => notify(getErrorMessage(e, 'Could not reorder'), 'error'),
    });

  // Group past orders under day headings.
  let lastDay = '';

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Receipt size={14} /> Orders</span>
          <h1 style={{ marginTop: 6 }}>Your orders</h1>
          <p>{all.length ? `${all.length} orders · ${formatMoney(past.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').reduce((s, o) => s + Number(o.totalAmount), 0))} delivered so far` : 'Live deliveries and everything you have ordered before.'}</p>
        </div>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={<Utensils size={28} />} title="No orders yet" boxed>
          <p>When you order, you can follow the kitchen and your rider live from here.</p>
          <Link to="/" className="btn btn--primary">Find something to eat</Link>
        </EmptyState>
      ) : (
        <>
          {live.length > 0 && (
            <section className="stack" aria-label="Live orders" style={{ marginBottom: 32 }}>
              {live.map((o) => {
                const { name, art, logo } = info(o);
                return (
                  <Link key={o.id} to={`/orders/${o.id}`} className="card card--hover order-live">
                    <Art art={art} src={logo} className="order-live__art" />
                    <div className="stack stack--sm" style={{ minWidth: 0 }}>
                      <div className="row row--wrap">
                        <StatusBadge status={o.status} />
                        <span className="mono small muted">#{shortOrderNo(o.orderNumber)}</span>
                      </div>
                      <h3>{ORDER_STATUS_COPY[o.status][0]}</h3>
                      <span className="small muted truncate">{name} · {o.items.map((i) => `${i.quantity}× ${i.dishName}`).join(', ')}</span>
                      <div className="meter" style={{ maxWidth: 420 }}><span style={{ width: `${Math.max(6, orderProgress(o.status) * 100)}%` }} /></div>
                    </div>
                    <span className="btn btn--primary btn--sm">Track live <ArrowRight size={15} /></span>
                  </Link>
                );
              })}
            </section>
          )}

          {past.length > 0 && (
            <section aria-label="Past orders">
              <div className="section-head">
                <h2>Past orders</h2>
                <Segmented<Tab>
                  label="Filter past orders"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'ALL', label: 'All', count: past.length },
                    { value: 'DELIVERED', label: 'Delivered' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />
              </div>
              {shown.length === 0 ? (
                <p className="muted state">Nothing here.</p>
              ) : (
                <div className="stack stack--sm">
                  {shown.map((o) => {
                    const { name, art, logo } = info(o);
                    const day = formatDay(o.createdAt);
                    const heading = day !== lastDay ? day : null;
                    lastDay = day;
                    const delivered = o.status === 'DELIVERED' || o.status === 'COMPLETED';
                    return (
                      <Fragment key={o.id}>
                        {heading && <h3 className="date-label">{heading}</h3>}
                        <div className="card order-row">
                          <Art art={art} src={logo} className="order-row__art" />
                          <Link to={`/orders/${o.id}`} style={{ minWidth: 0 }}>
                            <div className="row row--wrap">
                              <strong>{name}</strong>
                              <StatusBadge status={o.status} />
                            </div>
                            <p className="small muted truncate">{o.items.map((i) => `${i.quantity}× ${i.dishName}`).join(', ')}</p>
                            <p className="tiny faint">
                              {formatTime(o.createdAt)} · <span className="mono">#{shortOrderNo(o.orderNumber)}</span> · {formatMoney(o.totalAmount)}
                            </p>
                          </Link>
                          <div className="order-row__actions">
                            {delivered && (
                              <button className="btn btn--secondary btn--sm" disabled={reorder.isPending} onClick={() => doReorder(o)}>
                                {reorder.isPending && reorder.variables?.id === o.id ? <Spinner size={14} /> : <RotateCcw size={14} />} Reorder
                              </button>
                            )}
                            <Link to={`/orders/${o.id}`} className="btn btn--ghost btn--sm">Details</Link>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
