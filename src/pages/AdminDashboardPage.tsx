import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bike, CircleDollarSign, LayoutDashboard, Radio, Receipt, Send, Store } from 'lucide-react';
import { useAllAssignments, useNow, useOrders, useRestaurants, useRiders } from '../hooks/queries';
import { DispatchModal } from '../components/DispatchModal';
import { Badge, EmptyState, ErrorState, LoadingState, Segmented, Stat, StatusBadge, useDocumentTitle } from '../components/ui';
import {
  ACTIVE_ASSIGNMENT,
  ASSIGNMENT_LABEL,
  ORDER_FLOW,
  ORDER_STEP_LABEL,
  TRANSPORT_LABEL,
  formatMoney,
  formatTime,
  initials,
  isLiveOrder,
  minutesSince,
  parseServerDate,
  shortOrderNo,
} from '../lib/format';
import type { OrderResponse, OrderStatus } from '../types/api';

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  PENDING: 'var(--warn)',
  ACCEPTED: 'var(--info)',
  IN_PREPARATION: 'var(--accent)',
  READY_FOR_PICKUP: '#c084fc',
  OUT_FOR_DELIVERY: 'var(--success)',
};

type Filter = 'live' | 'all' | 'issues';

export default function AdminDashboardPage() {
  useDocumentTitle('Operations');
  const navigate = useNavigate();
  const now = useNow(20_000);
  const orders = useOrders({}, { poll: 6_000 });
  const assignments = useAllAssignments();
  const riders = useRiders();
  const { data: restaurants } = useRestaurants();
  // Until someone picks a tab, show live orders when there are any, otherwise everything.
  const [picked, setFilter] = useState<Filter | null>(null);
  const [dispatching, setDispatching] = useState<OrderResponse | null>(null);

  const all = useMemo(() => orders.data ?? [], [orders.data]);
  const activeAssignments = (assignments.data ?? []).filter((a) => ACTIVE_ASSIGNMENT.includes(a.status));
  const hasRider = (orderId: number) => activeAssignments.some((a) => a.orderId === orderId);

  if (orders.isPending) return <LoadingState label="Loading operations…" />;
  if (orders.error) return <div className="container page"><ErrorState error={orders.error} onRetry={() => orders.refetch()} /></div>;

  const live = all.filter((o) => isLiveOrder(o.status));
  const today = all.filter((o) => parseServerDate(o.createdAt)?.toDateString() === new Date().toDateString());
  const gmv = today.filter((o) => !['CANCELLED', 'DECLINED'].includes(o.status)).reduce((s, o) => s + Number(o.totalAmount), 0);
  const fleet = riders.data ?? [];
  const online = fleet.filter((r) => r.availability && r.status === 'ACTIVE').length;
  const needsRider = all
    .filter((o) => ['ACCEPTED', 'IN_PREPARATION', 'READY_FOR_PICKUP'].includes(o.status) && !hasRider(o.id))
    .sort((a, b) => (b.status === 'READY_FOR_PICKUP' ? 1 : 0) - (a.status === 'READY_FOR_PICKUP' ? 1 : 0) || a.id - b.id);

  const filter: Filter = picked ?? (live.length ? 'live' : 'all');
  const byStatus = ORDER_FLOW.slice(0, 5).map((s) => ({ s, n: live.filter((o) => o.status === s).length }));
  const rows = (filter === 'live' ? live : filter === 'issues' ? all.filter((o) => o.status === 'CANCELLED' || o.status === 'DECLINED') : all).slice(0, 25);
  const restName = (o: OrderResponse) => o.restaurantName ?? restaurants?.find((r) => r.id === o.restaurantId)?.name ?? `#${o.restaurantId}`;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><LayoutDashboard size={14} /> Operations</span>
          <h1 style={{ marginTop: 6 }}>Platform control room</h1>
          <p>Everything moving across UTown right now. Refreshes every few seconds.</p>
        </div>
        <Badge tone="success" dot live>Live</Badge>
      </div>

      <div className="stats">
        <Stat icon={<Activity size={14} />} label="Live orders" value={live.length} hint={`${live.filter((o) => o.status === 'PENDING').length} waiting on a kitchen`} />
        <Stat icon={<Receipt size={14} />} label="Orders today" value={today.length} hint={`${all.length} all-time`} />
        <Stat icon={<CircleDollarSign size={14} />} label="GMV today" value={formatMoney(gmv)} hint="Excludes cancelled & declined" />
        <Stat icon={<Bike size={14} />} label="Riders online" value={`${online}/${fleet.length}`} hint={`${activeAssignments.length} on a delivery`} />
      </div>

      <div className="ops-grid">
        <div className="stack">
          <section className="panel">
            <header className="panel__head">
              <h2><Radio size={18} /> Live pipeline</h2>
              <span className="small muted">{live.length} in flight</span>
            </header>
            {live.length === 0 ? (
              <p className="muted small">No live orders. Place one as the customer to watch it move through here.</p>
            ) : (
              <>
                <div className="status-bar" role="img" aria-label="Live orders by status">
                  {byStatus.filter((b) => b.n > 0).map((b) => (
                    <span key={b.s} style={{ flexGrow: b.n, background: STATUS_COLOR[b.s] }} title={`${ORDER_STEP_LABEL[b.s]}: ${b.n}`} />
                  ))}
                </div>
                <div className="legend">
                  {byStatus.map((b) => (
                    <span key={b.s}><i style={{ background: STATUS_COLOR[b.s] }} /> {ORDER_STEP_LABEL[b.s]} · {b.n}</span>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="queue-title">
            <header className="panel__head">
              <h2 id="queue-title"><Send size={18} /> Needs a rider</h2>
              <Badge tone={needsRider.length ? 'warn' : 'success'}>{needsRider.length || 'All covered'}</Badge>
            </header>
            {needsRider.length === 0 ? (
              <p className="muted small">Every accepted order has a rider. New ones show up here as kitchens accept them.</p>
            ) : (
              needsRider.map((o) => (
                <div key={o.id} className="queue-item">
                  <div style={{ minWidth: 0 }}>
                    <div className="row row--wrap">
                      <strong>{restName(o)}</strong>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="small muted truncate">
                      <span className="mono">#{shortOrderNo(o.orderNumber)}</span> · {o.deliveryAddress ?? 'Customer address'} · {minutesSince(o.createdAt, now)} min old
                    </p>
                  </div>
                  <div className="queue-item__actions">
                    <button className="btn btn--primary btn--sm" onClick={() => setDispatching(o)} id={`dispatch-${o.id}`}>
                      <Bike size={14} /> Assign rider
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="panel">
            <header className="panel__head">
              <h2><Receipt size={18} /> Orders</h2>
              <Segmented<Filter>
                label="Filter orders"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'live', label: 'Live', count: live.length },
                  { value: 'all', label: 'All', count: all.length },
                  { value: 'issues', label: 'Cancelled' },
                ]}
              />
            </header>
            {rows.length === 0 ? (
              <EmptyState icon={<Receipt size={24} />} title="Nothing here" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Rider</th><th>Total</th><th>Placed</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => {
                      const a = (assignments.data ?? []).find((x) => x.orderId === o.id && x.status !== 'CANCELLED');
                      return (
                        <tr key={o.id} className="is-link" onClick={() => navigate(`/orders/${o.id}`)}>
                          <td className="mono">#{shortOrderNo(o.orderNumber)}</td>
                          <td>{restName(o)}</td>
                          <td><StatusBadge status={o.status} /></td>
                          <td className="muted">{a?.riderName ?? '—'}</td>
                          <td>{formatMoney(o.totalAmount)}</td>
                          <td className="muted">{formatTime(o.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <header className="panel__head">
              <h2><Bike size={18} /> Fleet</h2>
              <span className="small muted">{online} online</span>
            </header>
            {fleet.length === 0 && <p className="muted small">No riders registered.</p>}
            {fleet.map((r) => {
              const job = activeAssignments.find((a) => a.riderId === r.id);
              const state = job ? 'is-busy' : r.availability && r.status === 'ACTIVE' ? 'is-on' : '';
              return (
                <div key={r.id} className="fleet-item">
                  <span className="avatar role--rider">{initials(r.userName)}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block' }} className="truncate">{r.userName ?? `Rider #${r.id}`}</strong>
                    <span className="small muted truncate" style={{ display: 'block' }}>
                      {job ? `${ASSIGNMENT_LABEL[job.status]} · ${job.restaurantName}` : `${TRANSPORT_LABEL[r.transportType]} · ${r.availability ? 'available' : 'offline'}`}
                    </span>
                  </span>
                  <span className={`presence ${state}`} title={state === 'is-busy' ? 'On a job' : state ? 'Available' : 'Offline'} />
                </div>
              );
            })}
          </section>

          <section className="panel">
            <header className="panel__head"><h2><Store size={18} /> Restaurants</h2></header>
            {(restaurants ?? []).map((r) => {
              const n = live.filter((o) => o.restaurantId === r.id).length;
              const open = r.status === 'OPEN' && r.isOpenNow;
              return (
                <div key={r.id} className="fleet-item">
                  <span className={`presence ${open ? 'is-on' : ''}`} />
                  <span className="grow truncate">{r.name}</span>
                  {n > 0 ? <Badge tone="accent">{n} live</Badge> : <span className="tiny muted">{open ? 'Open' : 'Closed'}</span>}
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <DispatchModal order={dispatching} onClose={() => setDispatching(null)} />
    </div>
  );
}
