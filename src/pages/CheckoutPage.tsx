import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CreditCard, House, Landmark, Lock, Plus, ShoppingBag } from 'lucide-react';
import { addressApi, orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { rememberLastOrder } from '../auth/useSwitchRole';
import { qk, useAddresses, useAreas, useCart, useCities, useRestaurants, useRestaurantTypes } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { Art, EmptyState, ErrorState, LoadingState, Spinner, useDocumentTitle } from '../components/ui';
import { PAYMENT_LABEL, cx, dishArt, formatMoney } from '../lib/format';
import type { AddressRequest, PaymentMethod } from '../types/api';

const PAYMENT_ICON: Record<PaymentMethod, typeof CreditCard> = { CARD: CreditCard, CASH: Banknote, BANK_TRANSFER: Landmark };

function AddressForm({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const { data: cities } = useCities();
  const [cityId, setCityId] = useState<number | undefined>();
  const { data: areas } = useAreas(cityId);
  const [areaId, setAreaId] = useState<number | undefined>();

  useEffect(() => { if (!cityId && cities?.length) setCityId(cities[0].id); }, [cities, cityId]);
  useEffect(() => { setAreaId(areas?.[0]?.id); }, [areas]);

  const create = useMutation({
    mutationFn: (body: AddressRequest) => addressApi.create(body),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: qk.addresses(user?.id) });
      notify('Address saved', 'success');
      onCreated(a.id);
    },
    onError: (e) => notify(getErrorMessage(e, 'Could not save address'), 'error'),
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !cityId || !areaId) return;
    const f = new FormData(e.currentTarget);
    create.mutate({
      userId: user.id,
      cityId,
      deliveryAreaId: areaId,
      recipientName: String(f.get('recipientName') || user.name),
      phone: user.phone,
      addressLine: String(f.get('addressLine')),
      label: String(f.get('label') || '') || undefined,
    });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>City</span>
          <select className="select" value={cityId ?? ''} onChange={(e) => setCityId(Number(e.target.value))} required>
            {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Neighbourhood</span>
          <select className="select" value={areaId ?? ''} onChange={(e) => setAreaId(Number(e.target.value))} required>
            {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field span-2">
          <span>Street address</span>
          <input className="input" name="addressLine" required placeholder="e.g. 12 Teheran-ro, Apt 301" autoComplete="street-address" />
        </label>
        <label className="field">
          <span>Recipient</span>
          <input className="input" name="recipientName" defaultValue={user?.name} required />
        </label>
        <label className="field">
          <span>Label</span>
          <input className="input" name="label" placeholder="Home, Office…" />
        </label>
      </div>
      <div className="row">
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn--primary" disabled={create.isPending || !areaId}>
          {create.isPending ? <Spinner /> : 'Save address'}
        </button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  useDocumentTitle('Checkout');
  const { user } = useAuth();
  const cart = useCart();
  const addresses = useAddresses();
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
  const { data: cities } = useCities();
  const { notify } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>('CARD');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (addressId == null && addresses.data?.length) setAddressId(addresses.data[0].id);
  }, [addresses.data, addressId]);

  const restaurant = restaurants?.find((r) => r.id === cart.data?.restaurantId);

  const checkout = useMutation({
    mutationFn: () =>
      orderApi.checkout({ userId: user!.id, addressId: addressId!, paymentMethod: payment, deliveryNote: note.trim() || undefined }),
    onSuccess: (order) => {
      qc.setQueryData(qk.order(order.id), order);
      qc.invalidateQueries({ queryKey: qk.cart(user?.id) });
      qc.invalidateQueries({ queryKey: ['orders'] });
      rememberLastOrder({ id: order.id, restaurantId: order.restaurantId, ownerId: restaurant?.ownerId });
      notify('Order placed! The kitchen has it.', 'success');
      navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
    },
    onError: (e) => notify(getErrorMessage(e, 'Checkout failed'), 'error'),
  });

  if (cart.isPending || addresses.isPending) return <LoadingState label="Preparing checkout…" />;
  if (cart.error) return <div className="container page"><ErrorState error={cart.error} onRetry={() => cart.refetch()} /></div>;

  const items = cart.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon={<ShoppingBag size={28} />} title="Nothing to check out" boxed>
          <p>Your bag is empty — find something good first.</p>
          <Link to="/" className="btn btn--primary">Browse restaurants</Link>
        </EmptyState>
      </div>
    );
  }

  const cuisine = types?.find((t) => t.id === restaurant?.typeId)?.name;
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const minimum = restaurant?.minimumOrderAmount ?? 0;
  const belowMin = subtotal < minimum;
  const list = addresses.data ?? [];
  const showForm = adding || list.length === 0;
  const cityName = (id: number) => cities?.find((c) => c.id === id)?.name;

  return (
    <div className="container page">
      <Link to={`/restaurant/${cart.data?.restaurantId}`} className="back-link"><ArrowLeft size={16} /> Back to {cart.data?.restaurantName}</Link>
      <div className="page-head">
        <div>
          <h1>Checkout</h1>
          <p>Three quick steps and it's on its way.</p>
        </div>
      </div>

      <div className="split">
        <div className="checkout-steps">
          <section className="panel">
            <header className="panel__head">
              <h2><span className="step-num">1</span> Deliver to</h2>
              {!showForm && (
                <button className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}><Plus size={14} /> New address</button>
              )}
            </header>
            {!showForm && (
              <div className="choice-list">
                {list.map((a) => (
                  <label key={a.id} className={cx('choice', addressId === a.id && 'is-checked')}>
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span className="choice__icon"><House size={18} /></span>
                    <span className="grow">
                      <strong>{a.label || a.recipientName}</strong>
                      <span className="small muted" style={{ display: 'block' }}>
                        {a.addressLine}
                        {cityName(a.cityId) ? ` · ${cityName(a.cityId)}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {showForm && (
              <AddressForm
                onCreated={(id) => { setAddressId(id); setAdding(false); }}
                onCancel={list.length ? () => setAdding(false) : undefined}
              />
            )}
          </section>

          <section className="panel">
            <header className="panel__head"><h2><span className="step-num">2</span> Pay with</h2></header>
            <div className="pay-grid">
              {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => {
                const I = PAYMENT_ICON[m];
                return (
                  <label key={m} className={cx('choice', payment === m && 'is-checked')}>
                    <input type="radio" name="payment" checked={payment === m} onChange={() => setPayment(m)} id={`pay-${m.toLowerCase()}`} />
                    <span className="choice__icon"><I size={20} /></span>
                    <span>{PAYMENT_LABEL[m]}</span>
                  </label>
                );
              })}
            </div>
            <p className="small muted row" style={{ marginTop: 12 }}><Lock size={13} /> Payments run through a mock gateway — nothing is charged.</p>
          </section>

          <section className="panel">
            <header className="panel__head"><h2><span className="step-num">3</span> Note for the rider</h2></header>
            <textarea
              className="textarea"
              rows={2}
              maxLength={250}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Door code, leave at the door, ring twice… (optional)"
            />
          </section>
        </div>

        <aside className="panel sticky" aria-label="Order summary">
          <div className="row" style={{ gap: 12 }}>
            <Art art={dishArt('', cuisine, cart.data?.restaurantName)} className="summary-item__art" />
            <div>
              <span className="tiny muted strong">YOUR ORDER FROM</span>
              <h3>{cart.data?.restaurantName}</h3>
            </div>
          </div>
          <ul className="summary-list" style={{ listStyle: 'none' }}>
            {items.map((i) => (
              <li key={i.id} className="summary-item">
                <span className="strong accent">{i.quantity}×</span>
                <span className="grow">
                  <strong>{i.dishName}</strong>
                  {i.options?.length ? <span className="tiny muted" style={{ display: 'block' }}>{i.options.map((o) => o.optionName).join(', ')}</span> : null}
                </span>
                <span>{formatMoney(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="totals">
            <div className="totals__row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="totals__row"><span>Delivery</span><span className="accent strong">Free</span></div>
            <div className="totals__row totals__row--total"><span>Total</span><span>{formatMoney(subtotal)}</span></div>
          </div>
          {belowMin && (
            <p className="notice" style={{ marginTop: 14 }}>Minimum order is {formatMoney(minimum)}. Add {formatMoney(minimum - subtotal)} more.</p>
          )}
          <button
            id="place-order"
            className="btn btn--primary btn--block btn--lg"
            style={{ marginTop: 16 }}
            disabled={!addressId || showForm || belowMin || checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending ? <Spinner /> : `Place order · ${formatMoney(subtotal)}`}
          </button>
        </aside>
      </div>
    </div>
  );
}
