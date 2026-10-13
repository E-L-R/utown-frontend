import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Plus, ShoppingBag, Star, UtensilsCrossed } from 'lucide-react';
import { useCart, useCartMutations, useMenu, useRestaurants } from '../hooks/queries';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useCartDrawer } from '../components/Layout';
import { DishOptionsModal } from '../components/DishOptionsModal';
import { Badge, EmptyState, ErrorState, LoadingState, Modal, SmartImage } from '../components/ui';
import { cx, fallbackImage, formatMoney } from '../lib/format';
import { getErrorMessage } from '../api/client';
import type { MenuDish } from '../types/api';

interface PendingAdd {
  dish: MenuDish;
  quantity: number;
  optionIds: number[];
}

export default function RestaurantPage() {
  const id = Number(useParams().id);
  const menu = useMenu(id);
  const { data: restaurants } = useRestaurants();
  const { data: cart } = useCart();
  const { add } = useCartMutations();
  const { user } = useAuth();
  const { notify } = useToast();
  const drawer = useCartDrawer();
  const navigate = useNavigate();

  const [activeDish, setActiveDish] = useState<MenuDish | null>(null);
  const [conflict, setConflict] = useState<PendingAdd | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const restaurant = restaurants?.find((r) => r.id === id);
  const name = menu.data?.restaurantName ?? restaurant?.name ?? 'Restaurant';
  const categories = (menu.data?.categories ?? [])
    .filter((c) => c.dishes.length > 0)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  // Scroll-spy for category tabs.
  useEffect(() => {
    if (!categories.length) return;
    setActiveCat((c) => c ?? categories[0].id);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(Number((visible.target as HTMLElement).dataset.cat));
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAdd = (p: PendingAdd, clearExisting = false) =>
    add.mutate(
      { body: { restaurantId: id, dishId: p.dish.id, quantity: p.quantity, optionIds: p.optionIds }, clearExisting },
      {
        onSuccess: () => {
          notify(`${p.dish.name} added to your bag`, 'success');
          setActiveDish(null);
          setConflict(null);
        },
        onError: (e) => notify(getErrorMessage(e, 'Could not add to cart'), 'error'),
      },
    );

  const handleConfirm = (dish: MenuDish, quantity: number, optionIds: number[]) => {
    if (user?.role !== 'CUSTOMER') {
      notify('Sign in as a Customer to order — use the demo switcher.', 'info');
      return;
    }
    const pending = { dish, quantity, optionIds };
    if (cart?.restaurantId && cart.restaurantId !== id && cart.items.length > 0) {
      setActiveDish(null);
      setConflict(pending);
      return;
    }
    doAdd(pending);
  };

  const isOpen = (menu.data?.restaurantStatus ?? restaurant?.status) === 'OPEN' && (restaurant?.isOpenNow ?? true);
  const cartHere = cart?.restaurantId === id ? cart : null;
  const cartCount = cartHere?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  if (menu.isPending) return <LoadingState label="Loading menu…" />;
  if (menu.error) return <div className="container section"><ErrorState error={menu.error} onRetry={() => menu.refetch()} /></div>;

  return (
    <>
      <section className="r-hero">
        <img src={restaurant?.logoUrl || fallbackImage(name)} alt="" className="r-hero__img" />
        <div className="container r-hero__content">
          <Link to="/" className="back-link"><ArrowLeft size={16} /> All restaurants</Link>
          <div className="row gap-sm">
            <Badge tone={isOpen ? 'success' : 'neutral'} dot>{isOpen ? 'Open now' : 'Closed'}</Badge>
          </div>
          <h1>{name}</h1>
          {restaurant?.description && <p className="r-hero__desc">{restaurant.description}</p>}
          <div className="r-hero__meta">
            {restaurant && <span><Star size={15} fill="currentColor" className="star" /> {Number(restaurant.averageRating).toFixed(1)}</span>}
            {restaurant && <span><Clock size={15} /> {restaurant.deliveryTimeMinutes}–{restaurant.deliveryTimeMinutes + 10} min</span>}
            <span>Min. order {formatMoney(menu.data?.minimumOrderAmount ?? restaurant?.minimumOrderAmount)}</span>
            {restaurant?.address && <span><MapPin size={15} /> {restaurant.address}</span>}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <nav className="cat-tabs">
          <div className="container cat-tabs__inner">
            {categories.map((c) => (
              <button
                key={c.id}
                className={cx('cat-tab', activeCat === c.id && 'is-active')}
                onClick={() => {
                  setActiveCat(c.id);
                  const el = sectionRefs.current[c.id];
                  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
                }}
              >
                {c.name}
                <span className="cat-tab__count">{c.dishes.length}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      <div className="container section">
        {categories.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed size={28} />} title="No dishes yet">This restaurant hasn't published a menu.</EmptyState>
        ) : (
          categories.map((c) => (
            <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="menu-section">
              <h2>{c.name}</h2>
              {c.description && <p className="muted">{c.description}</p>}
              <div className="grid grid--dishes">
                {c.dishes.map((d) => {
                  const available = d.status === 'AVAILABLE' && isOpen;
                  return (
                    <article key={d.id} className={cx('card dish-card', !available && 'is-disabled')} id={`dish-${d.id}`}>
                      <div className="dish-card__info">
                        <h3>{d.name}</h3>
                        {d.description && <p className="muted small line-clamp">{d.description}</p>}
                        <div className="dish-card__foot">
                          <strong>{formatMoney(d.price)}</strong>
                          {d.optionGroups.length > 0 && <span className="muted small">Customisable</span>}
                          {d.status !== 'AVAILABLE' && <Badge tone="neutral">Unavailable</Badge>}
                        </div>
                      </div>
                      <div className="dish-card__media">
                        <SmartImage src={d.imageUrl} alt={d.name} hints={[name]} />
                        <button
                          className="add-btn"
                          disabled={!available}
                          onClick={() => setActiveDish(d)}
                          aria-label={`Add ${d.name}`}
                          id={`add-dish-${d.id}`}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {cartCount > 0 && (
        <button className="floating-cart" onClick={drawer.open}>
          <ShoppingBag size={18} />
          <span>{cartCount} item{cartCount > 1 ? 's' : ''}</span>
          <strong>{formatMoney(cartHere?.items.reduce((s, i) => s + i.subtotal, 0))}</strong>
        </button>
      )}

      <DishOptionsModal
        dish={activeDish}
        restaurantName={name}
        onClose={() => setActiveDish(null)}
        onConfirm={handleConfirm}
        submitting={add.isPending}
      />

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="Start a new bag?"
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setConflict(null)}>Keep current bag</button>
            <button className="btn btn--primary grow" disabled={add.isPending} onClick={() => conflict && doAdd(conflict, true)}>
              Clear & add
            </button>
          </div>
        }
      >
        <p>
          Your bag has items from <strong>{cart?.restaurantName}</strong>. Orders can only contain dishes from one restaurant.
        </p>
        <button className="btn btn--text" onClick={() => { setConflict(null); navigate('/checkout'); }}>
          Or check out your current bag →
        </button>
      </Modal>
    </>
  );
}
