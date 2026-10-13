import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart, useCartMutations, useRestaurants } from '../hooks/queries';
import { formatMoney, cx } from '../lib/format';
import { getErrorMessage } from '../api/client';
import { useToast } from './Toast';
import { EmptyState, ErrorState, QuantityStepper, SmartImage, Spinner } from './ui';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cart, isPending, error, refetch } = useCart();
  const { data: restaurants } = useRestaurants();
  const { update, remove, clear } = useCartMutations();
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const restaurant = restaurants?.find((r) => r.id === cart?.restaurantId);
  const items = cart?.items ?? [];
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const minimum = restaurant?.minimumOrderAmount ?? 0;
  const shortBy = Math.max(0, minimum - total);

  const onErr = (e: unknown) => notify(getErrorMessage(e), 'error');

  return (
    <>
      <div className={cx('drawer-scrim', open && 'is-open')} onClick={onClose} aria-hidden />
      <aside className={cx('drawer', open && 'is-open')} aria-label="Cart" aria-hidden={!open}>
        <header className="drawer__head">
          <div>
            <h2>Your bag</h2>
            {cart?.restaurantName && <p className="muted small">from {cart.restaurantName}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close cart">
            <X size={18} />
          </button>
        </header>

        <div className="drawer__body">
          {isPending ? (
            <div className="state"><Spinner size={24} /></div>
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : items.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={28} />} title="Your bag is empty">
              Add something delicious from a restaurant menu.
            </EmptyState>
          ) : (
            <ul className="cart-list">
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  <SmartImage src={item.dishImageUrl} alt={item.dishName} hints={[cart?.restaurantName]} className="cart-item__img" />
                  <div className="cart-item__info">
                    <strong>{item.dishName}</strong>
                    {item.options && item.options.length > 0 && (
                      <span className="muted small">
                        {item.options.map((o) => `${o.optionName}${o.optionPrice ? ` +${formatMoney(o.optionPrice)}` : ''}`).join(' · ')}
                      </span>
                    )}
                    <span className="muted small">{formatMoney(item.unitPrice)} each</span>
                    <div className="cart-item__row">
                      <QuantityStepper
                        value={item.quantity}
                        disabled={update.isPending}
                        onChange={(quantity) => update.mutate({ itemId: item.id, quantity }, { onError: onErr })}
                      />
                      <strong>{formatMoney(item.subtotal)}</strong>
                    </div>
                  </div>
                  <button
                    className="icon-btn icon-btn--sm"
                    onClick={() => remove.mutate(item.id, { onError: onErr })}
                    aria-label={`Remove ${item.dishName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="drawer__foot">
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            {shortBy > 0 && (
              <div className="min-order">
                <div className="min-order__bar"><span style={{ width: `${Math.min(100, (total / minimum) * 100)}%` }} /></div>
                <span className="small">Add {formatMoney(shortBy)} more to reach the {formatMoney(minimum)} minimum</span>
              </div>
            )}
            <button
              id="go-to-checkout"
              className="btn btn--primary btn--block btn--lg"
              disabled={shortBy > 0}
              onClick={() => {
                onClose();
                navigate('/checkout');
              }}
            >
              Go to checkout · {formatMoney(total)}
            </button>
            <button
              className="btn btn--text btn--block"
              disabled={clear.isPending}
              onClick={() => clear.mutate(undefined, { onError: onErr, onSuccess: () => notify('Cart cleared') })}
            >
              Clear bag
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
