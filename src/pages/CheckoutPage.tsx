import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, House, Landmark, MapPin, Plus, ShoppingBag } from 'lucide-react';
import { addressApi, orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { qk, useAddresses, useAreas, useCart, useCities, useRestaurants } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, LoadingState, SmartImage, Spinner } from '../components/ui';
import { PAYMENT_LABEL, cx, formatMoney } from '../lib/format';
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
      phone: String(f.get('phone') || user.phone),
      addressLine: String(f.get('addressLine')),
      label: String(f.get('label') || '') || undefined,
    });
  };

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>City</span>
          <select value={cityId ?? ''} onChange={(e) => setCityId(Number(e.target.value))} required>
            {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Delivery area</span>
          <select value={areaId ?? ''} onChange={(e) => setAreaId(Number(e.target.value))} required>
            {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field span-2">
          <span>Street address</span>
          <input name="addressLine" required placeholder="e.g. 12 Teheran-ro, Apt 301" />
        </label>
        <label className="field">
          <span>Recipient</span>
          <input name="recipientName" defaultValue={user?.name} required />
        </label>
        <label className="field">
          <span>Label</span>
          <input name="label" placeholder="Home, Office…" />
        </label>
      </div>
      <div className="row gap-sm">
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn btn--primary" disabled={create.isPending || !areaId}>
          {create.isPending ? <Spinner /> : 'Save address'}
        </button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const cart = useCart();
  const addresses = useAddresses();
  const { data: restaurants } = useRestaurants();
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

  const checkout = useMutation({
    mutationFn: () =>
      orderApi.checkout({ userId: user!.id, addressId: addressId!, paymentMethod: payment, deliveryNote: note.trim() || undefined }),
    onSuccess: (order) => {
      qc.setQueryData(qk.order(order.id), order);
      qc.invalidateQueries({ queryKey: qk.cart(user?.id) });
      qc.invalidateQueries({ queryKey: ['orders'] });
      notify(`Order placed! #${order.orderNumber.slice(-8)}`, 'success');
      navigate(`/orders/${order.id}`);
    },
    onError: (e) => notify(getErrorMessage(e, 'Checkout failed'), 'error'),
  });

  if (cart.isPending || addresses.isPending) return <LoadingState label="Preparing checkout…" />;
  if (cart.error) return <div className="container section"><ErrorState error={cart.error} onRetry={() => cart.refetch()} /></div>;

  const items = cart.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="container section">
        <EmptyState icon={<ShoppingBag size={28} />} title="Nothing to check out">
          <p>Your bag is empty.</p>
          <Link to="/" className="btn btn--primary">Browse restaurants</Link>
        </EmptyState>
      </div>
    );
  }

  const restaurant = restaurants?.find((r) => r.id === cart.data?.restaurantId);
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const minimum = restaurant?.minimumOrderAmount ?? 0;
  const belowMin = subtotal < minimum;
  const list = addresses.data ?? [];
  const showForm = adding || list.length === 0;

  return (
    <div className="container section checkout">
      <div className="checkout__main">
        <h1>Checkout</h1>

        <section className="panel">
          <header className="panel__head">
            <h2><MapPin size={18} /> Delivery address</h2>
            {!showForm && (
              <button className="btn btn--text" onClick={() => setAdding(true)}><Plus size={14} /> New address</button>
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
                    <span className="muted small block">{a.addressLine}{a.postalCode ? `, ${a.postalCode}` : ''}</span>
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
          <header className="panel__head"><h2><CreditCard size={18} /> Payment method</h2></header>
          <div className="pay-grid">
            {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => {
              const I = PAYMENT_ICON[m];
              return (
                <label key={m} className={cx('pay-option', payment === m && 'is-checked')}>
                  <input type="radio" name="payment" checked={payment === m} onChange={() => setPayment(m)} id={`pay-${m.toLowerCase()}`} />
                  <I size={22} />
                  <span>{PAYMENT_LABEL[m]}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <header className="panel__head"><h2>Note for the rider</h2></header>
          <textarea
            className="textarea"
            rows={2}
            maxLength={250}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Door code, leave at the door, etc. (optional)"
          />
        </section>
      </div>

      <aside className="checkout__summary panel sticky">
        <h2>{cart.data?.restaurantName}</h2>
        <ul className="summary-items">
          {items.map((i) => (
            <li key={i.id}>
              <SmartImage src={i.dishImageUrl} alt={i.dishName} hints={[cart.data?.restaurantName]} className="summary-items__img" />
              <span className="grow">
                <strong>{i.quantity}× {i.dishName}</strong>
                {i.options?.length ? <span className="muted small block">{i.options.map((o) => o.optionName).join(', ')}</span> : null}
              </span>
              <span>{formatMoney(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="summary-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
        <div className="summary-row muted"><span>Delivery fee</span><span>Calculated on order</span></div>
        <div className="summary-row summary-row--total"><span>Total</span><strong>{formatMoney(subtotal)}</strong></div>
        {belowMin && <p className="warn-text small">Minimum order is {formatMoney(minimum)}. Add {formatMoney(minimum - subtotal)} more.</p>}
        <button
          id="place-order"
          className="btn btn--primary btn--block btn--lg"
          disabled={!addressId || showForm || belowMin || checkout.isPending}
          onClick={() => checkout.mutate()}
        >
          {checkout.isPending ? <Spinner /> : `Place order · ${formatMoney(subtotal)}`}
        </button>
        <p className="muted small center">Paying with {PAYMENT_LABEL[payment].toLowerCase()}</p>
      </aside>
    </div>
  );
}
