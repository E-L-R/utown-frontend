import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, CheckCircle2, Clock, Flag, MapPin, Package, Power, Store, Trophy } from 'lucide-react';
import { deliveryApi, orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { DEMO_ACCOUNTS, useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { qk, useInvalidateOrders, useMyAssignments, useRestaurants, useRiderProfile } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { Badge, EmptyState, ErrorState, LoadingState, Spinner, Stat, useDocumentTitle } from '../components/ui';
import {
  ACTIVE_ASSIGNMENT,
  ASSIGNMENT_LABEL,
  ASSIGNMENT_TONE,
  TRANSPORT_LABEL,
  cx,
  formatMoney,
  formatTime,
  initials,
  parseServerDate,
  shortOrderNo,
} from '../lib/format';
import type { DeliveryAssignmentResponse } from '../types/api';

const STEP: Record<string, number> = { ASSIGNED: 0, ACCEPTED: 1, PICKED_UP: 2, DELIVERED: 3 };

function JobCard({ job }: { job: DeliveryAssignmentResponse }) {
  const { data: restaurants } = useRestaurants();
  // Riders can read the order they're delivering (address, items, note).
  const { data: order } = useQuery({ queryKey: qk.order(job.orderId), queryFn: () => orderApi.get(job.orderId), refetchInterval: 8_000 });
  const qc = useQueryClient();
  const invalidate = useInvalidateOrders();
  const { notify } = useToast();
  const restaurant = restaurants?.find((r) => r.id === job.restaurantId);
  const step = STEP[job.status] ?? 0;
  const kitchenReady = order?.status === 'READY_FOR_PICKUP';

  const act = useMutation({
    mutationFn: () => (job.status === 'ASSIGNED' ? deliveryApi.accept(job.id) : job.status === 'ACCEPTED' ? deliveryApi.pickup(job.id) : deliveryApi.deliver(job.id)),
    onSuccess: (updated) => {
      qc.setQueryData<DeliveryAssignmentResponse[]>(qk.myAssignments, (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
      invalidate();
      qc.invalidateQueries({ queryKey: qk.order(job.orderId) });
      qc.invalidateQueries({ queryKey: ['rider'] });
      notify(
        { ACCEPTED: 'Job accepted — head to the restaurant', PICKED_UP: 'Picked up — off to the customer', DELIVERED: 'Delivered! Nice work.' }[updated.status as string] ?? 'Updated',
        'success',
      );
    },
    onError: (e) => notify(getErrorMessage(e, 'Could not update the job'), 'error'),
  });

  const action =
    job.status === 'ASSIGNED'
      ? { label: 'Accept job', icon: CheckCircle2, cls: 'btn--primary', disabled: false, hint: 'The restaurant is waiting for confirmation.' }
      : job.status === 'ACCEPTED'
        ? {
            label: kitchenReady ? 'Picked up the order' : 'Waiting for the kitchen…',
            icon: Package,
            cls: 'btn--primary',
            disabled: !kitchenReady,
            hint: kitchenReady ? 'Order is packed and waiting at the counter.' : 'You can pick up once the kitchen marks it ready.',
          }
        : { label: 'Mark as delivered', icon: Flag, cls: 'btn--success', disabled: false, hint: 'Hand it over, then confirm.' };

  return (
    <article className="job" id={`job-${job.id}`}>
      <header className="job__head">
        <span className="avatar avatar--lg role--rider"><Bike size={20} /></span>
        <div className="grow">
          <div className="row row--wrap">
            <Badge tone={ASSIGNMENT_TONE[job.status]} dot live>{ASSIGNMENT_LABEL[job.status]}</Badge>
            <span className="mono small muted">#{shortOrderNo(job.orderNumber, job.orderId)}</span>
          </div>
          <h2 style={{ marginTop: 4 }}>{job.restaurantName ?? restaurant?.name}</h2>
        </div>
        {order && <strong className="nowrap">{formatMoney(order.totalAmount)}</strong>}
      </header>
      <div className="job__body">
        <ol className="route">
          <li className={cx(step === 1 && 'is-active', step >= 2 && 'is-done')}>
            <span className="route__pin"><Store size={15} /></span>
            <span>
              <span className="route__label">Pick up</span>
              <span className="route__place" style={{ display: 'block' }}>{job.restaurantName ?? restaurant?.name}</span>
              <span className="small muted">{restaurant?.address ?? 'Restaurant address'}{restaurant?.phone ? ` · ${restaurant.phone}` : ''}</span>
            </span>
          </li>
          <li className={cx(step === 2 && 'is-active', step >= 3 && 'is-done')}>
            <span className="route__pin"><MapPin size={15} /></span>
            <span>
              <span className="route__label">Drop off</span>
              <span className="route__place" style={{ display: 'block' }}>{order?.deliveryAddress ?? 'Loading address…'}</span>
              {order?.deliveryNote && <span className="small" style={{ color: 'var(--warn)' }}>“{order.deliveryNote}”</span>}
            </span>
          </li>
        </ol>
        <div className="stack stack--sm">
          <span className="route__label">In the bag</span>
          {order ? (
            <ul className="ticket__items">
              {order.items.map((i) => (
                <li key={i.id}><b>{i.quantity}×</b><span>{i.dishName}</span></li>
              ))}
            </ul>
          ) : (
            <Spinner />
          )}
          {order?.paymentMethod === 'CASH' && (
            <div className="notice" style={{ marginTop: 6 }}><Banknote size={16} /> Collect {formatMoney(order.totalAmount)} in cash</div>
          )}
        </div>
      </div>
      <footer className="job__foot">
        <div className="job-steps" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className={cx(step > i && 'is-on')} />)}
        </div>
        <button className={cx('btn btn--xl btn--block', action.cls)} disabled={action.disabled || act.isPending} onClick={() => act.mutate()} id={`job-action-${job.id}`}>
          {act.isPending ? <Spinner /> : <><action.icon size={20} /> {action.label}</>}
        </button>
        <p className="small muted center" style={{ marginTop: 10 }}>{action.hint}</p>
      </footer>
    </article>
  );
}

export default function RiderDashboardPage() {
  useDocumentTitle('Deliveries');
  const { user } = useAuth();
  const profile = useRiderProfile();
  const jobs = useMyAssignments(Boolean(profile.data));
  const qc = useQueryClient();
  const { notify } = useToast();
  const { switchTo, pending: switching } = useSwitchRole();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (availability: boolean) => deliveryApi.setAvailability(profile.data!.id, availability),
    onSuccess: (p) => {
      qc.setQueryData(qk.rider(user?.id), p);
      notify(p.availability ? 'You’re online — dispatch can send you jobs' : 'You’re offline', p.availability ? 'success' : 'info');
    },
    onError: (e) => notify(getErrorMessage(e, 'Could not change status'), 'error'),
  });

  if (profile.isPending) return <LoadingState label="Loading your rider profile…" />;
  if (profile.error) return <div className="container page"><ErrorState error={profile.error} title="Could not load rider profile" /></div>;

  const rider = profile.data!;
  const all = [...(jobs.data ?? [])].sort((a, b) => b.id - a.id);
  const active = all.filter((a) => ACTIVE_ASSIGNMENT.includes(a.status));
  const done = all.filter((a) => a.status === 'DELIVERED');
  const today = done.filter((a) => parseServerDate(a.deliveredAt)?.toDateString() === new Date().toDateString());
  const onJob = active.length > 0;
  const online = rider.availability || onJob;

  return (
    <div className="container page">
      <div className="page-head">
        <div className="row" style={{ gap: 14 }}>
          <span className="avatar avatar--xl role--rider">{initials(rider.userName ?? user?.name)}</span>
          <div>
            <span className="eyebrow"><Bike size={14} /> Rider app</span>
            <h1 style={{ marginTop: 4 }}>Hi, {(rider.userName ?? user?.name ?? 'rider').split(' ')[0]}</h1>
            <p style={{ marginTop: 2 }}>{TRANSPORT_LABEL[rider.transportType]} courier · Seoul</p>
          </div>
        </div>
        <div className={cx('online-card', online && 'is-online')}>
          <Power size={18} className={online ? '' : 'muted'} style={online ? { color: 'var(--success)' } : undefined} />
          <span>
            <strong style={{ display: 'block' }}>{onJob ? 'On a delivery' : online ? 'Online' : 'Offline'}</strong>
            <span className="small muted">{onJob ? 'Finish this job to get the next one' : online ? 'Waiting for dispatch' : 'Go online to receive jobs'}</span>
          </span>
          <label className="switch" style={{ marginLeft: 8 }}>
            <input type="checkbox" checked={online} disabled={onJob || toggle.isPending} onChange={(e) => toggle.mutate(e.target.checked)} aria-label="Online" id="rider-online-toggle" />
            <span className="switch__track" />
          </label>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 24 }}>
        <Stat icon={<Package size={14} />} label="Active" value={active.length} hint={onJob ? 'In progress' : 'No job right now'} />
        <Stat icon={<CheckCircle2 size={14} />} label="Delivered today" value={today.length} />
        <Stat icon={<Trophy size={14} />} label="All-time" value={done.length} hint="Completed deliveries" />
        <Stat icon={<Clock size={14} />} label="Last drop-off" value={done[0]?.deliveredAt ? formatTime(done[0].deliveredAt) : '—'} />
      </div>

      {jobs.isPending ? (
        <LoadingState label="Checking for jobs…" />
      ) : jobs.error ? (
        <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : active.length ? (
        <div className="stack stack--lg">{active.map((j) => <JobCard key={j.id} job={j} />)}</div>
      ) : (
        <EmptyState icon={<Bike size={28} />} title={online ? 'Waiting for your next job' : 'You’re offline'} boxed>
          <p>
            {online
              ? 'When a kitchen calls a rider or operations dispatches you, the job pops up here automatically.'
              : 'Flip the switch above to start receiving delivery jobs.'}
          </p>
        </EmptyState>
      )}

      <section className="section" aria-label="Other demo riders">
        <p className="small muted" style={{ marginBottom: 10 }}>
          Job went to someone else? This demo has three riders — switch to see their app:
        </p>
        <div className="restaurant-tabs">
          {DEMO_ACCOUNTS.filter((a) => a.role === 'RIDER').map((a) => {
            const me = (rider.userPhone ?? user?.phone ?? '').replace(/\D/g, '').replace(/^82/, '0') === a.phone;
            return (
              <button
                key={a.phone}
                className={cx('restaurant-tab', me && 'is-active')}
                disabled={me || switching !== null}
                id={`switch-rider-${a.phone}`}
                onClick={async () => {
                  setSwitchingTo(a.phone);
                  await switchTo('RIDER', '/rider', { phone: a.phone });
                  setSwitchingTo(null);
                }}
              >
                <span className="avatar role--rider" style={{ width: 30, height: 30, fontSize: 11 }}>
                  {switchingTo === a.phone ? <Spinner size={14} /> : initials(a.name)}
                </span>
                {a.name}
                {me && <span className="muted small">You</span>}
              </button>
            );
          })}
        </div>
      </section>

      {done.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Completed trips</h2></div>
          <div className="stack stack--sm">
            {done.slice(0, 10).map((a) => (
              <div key={a.id} className="card mini-job">
                <span className="kv__icon"><Flag size={16} /></span>
                <span className="grow">
                  <strong>{a.restaurantName}</strong>
                  <span className="small muted" style={{ display: 'block' }}>#{shortOrderNo(a.orderNumber, a.orderId)} · delivered {formatTime(a.deliveredAt)}</span>
                </span>
                <Badge tone="success">Delivered</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
