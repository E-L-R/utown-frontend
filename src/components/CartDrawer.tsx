import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart, useCartMutations, useRestaurants, useRestaurantTypes } from '../hooks/queries';
import { cx, dishArt, formatMoney } from '../lib/format';
import { getErrorMessage } from '../api/client';
import { useToast } from './Toast';
import { Art, EmptyState, ErrorState, QuantityStepper, Spinner } from './ui';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: cart, isPending, error, refetch } = useCart();
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
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
  const cuisine = types?.find((t) => t.id === restaurant?.typeId)?.name;
  const items = cart?.items ?? [];
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const minimum = restaurant?.minimumOrderAmount ?? 0;
  const shortBy = Math.max(0, minimum - total);

  const onErr = (e: unknown) => notify(getErrorMessage(e), 'error');

  return (
    <>
      <div className={cx('drawer-scrim', open && 'is-open')} onClick={onClose} aria-hidden />
      <aside className={cx('drawer', open && 'is-open')} aria-label="Your bag" aria-hidden={!open}>
        <header className="drawer__head">
          <div>
            <h2>Your bag</h2>
            {cart?.restaurantName && (
              <Link to={`/restaurant/${cart.restaurantId}`} className="small muted" onClick={onClose}>
                from <strong style={{ color: 'var(--text)' }}>{cart.restaurantName}</strong>
              </Link>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close bag">
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
              <p>Add something delicious from a restaurant menu.</p>
              <button className="btn btn--secondary btn--sm" onClick={() => { onClose(); navigate('/'); }}>
                Browse restaurants
              </button>
            </EmptyState>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {items.map((item) => (
                <li key={item.id} className="line-item">
                  <Art art={dishArt(item.dishName, cuisine, cart?.restaurantName)} src={item.dishImageUrl} className="line-item__art" />
                  <div>
                    <div className="line-item__name">{item.dishName}</div>
                    {item.options && item.options.length > 0 && (
                      <div className="line-item__opts">
                        {item.options.map((o) => `${o.optionName}${o.optionPrice ? ` +${formatMoney(o.optionPrice)}` : ''}`).join(' · ')}
                      </div>
                    )}
                    <div className="line-item__foot">
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
            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <strong style={{ color: 'var(--text)' }}>{formatMoney(total)}</strong>
              </div>
            </div>
            {shortBy > 0 && (
              <div className="stack stack--sm">
                <div className="meter"><span style={{ width: `${Math.min(100, (total / minimum) * 100)}%` }} /></div>
                <span className="small muted">Add {formatMoney(shortBy)} more to reach the {formatMoney(minimum)} minimum.</span>
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
              Go to checkout <ArrowRight size={18} />
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={clear.isPending}
              onClick={() => clear.mutate(undefined, { onError: onErr, onSuccess: () => notify('Bag cleared') })}
            >
              Clear bag
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
