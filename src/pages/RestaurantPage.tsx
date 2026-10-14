import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bike, Clock, MapPin, Plus, Star, UtensilsCrossed } from 'lucide-react';
import { useCart, useCartMutations, useMenu, useRatings, useRestaurants, useRestaurantTypes } from '../hooks/queries';
import { useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { useToast } from '../components/Toast';
import { useCartDrawer } from '../components/Layout';
import { DishOptionsModal } from '../components/DishOptionsModal';
import { Art, Badge, EmptyState, ErrorState, LoadingState, Modal, Spinner, Stars, useDocumentTitle } from '../components/ui';
import { cx, dishArt, formatMoney, restaurantArt } from '../lib/format';
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
  const ratings = useRatings(id);
  const { data: restaurants } = useRestaurants();
  const { data: types } = useRestaurantTypes();
  const { data: cart } = useCart();
  const { add } = useCartMutations();
  const { user } = useAuth();
  const { switchTo, pending: switching } = useSwitchRole();
  const { notify } = useToast();
  const drawer = useCartDrawer();
  const navigate = useNavigate();

  const [activeDish, setActiveDish] = useState<MenuDish | null>(null);
  const [conflict, setConflict] = useState<PendingAdd | null>(null);
  const [needsCustomer, setNeedsCustomer] = useState<PendingAdd | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const restaurant = restaurants?.find((r) => r.id === id);
  const cuisine = types?.find((t) => t.id === restaurant?.typeId)?.name;
  const name = menu.data?.restaurantName ?? restaurant?.name ?? 'Restaurant';
  useDocumentTitle(name);

  const categories = useMemo(
    () =>
      (menu.data?.categories ?? [])
        .filter((c) => c.dishes.length > 0)
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)),
    [menu.data],
  );

  // Scroll-spy for the sticky category tabs.
  useEffect(() => {
    if (!categories.length) return;
    setActiveCat((c) => c ?? categories[0].id);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(Number((visible.target as HTMLElement).dataset.cat));
      },
      { rootMargin: '-150px 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories]);

  const cartHere = cart?.restaurantId === id ? cart : null;
  const cartCount = cartHere?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const qtyByDish = useMemo(() => {
    const m = new Map<number, number>();
    cartHere?.items.forEach((i) => m.set(i.dishId, (m.get(i.dishId) ?? 0) + i.quantity));
    return m;
  }, [cartHere]);

  // Lift the floating demo-tour pill above the cart bar.
  useEffect(() => {
    document.body.classList.toggle('has-cart-bar', cartCount > 0);
    return () => document.body.classList.remove('has-cart-bar');
  }, [cartCount]);

  const doAdd = (p: PendingAdd, clearExisting = false) =>
    add.mutate(
      { body: { restaurantId: id, dishId: p.dish.id, quantity: p.quantity, optionIds: p.optionIds }, clearExisting },
      {
        onSuccess: () => {
          notify(`${p.quantity > 1 ? `${p.quantity}× ` : ''}${p.dish.name} added to your bag`, 'success');
          setActiveDish(null);
          setConflict(null);
        },
        onError: (e) => notify(getErrorMessage(e, 'Could not add to bag'), 'error'),
      },
    );

  const handleConfirm = (dish: MenuDish, quantity: number, optionIds: number[]) => {
    const pending = { dish, quantity, optionIds };
    if (user?.role !== 'CUSTOMER') {
      setActiveDish(null);
      setNeedsCustomer(pending);
      return;
    }
    if (cart?.restaurantId && cart.restaurantId !== id && cart.items.length > 0) {
      setActiveDish(null);
      setConflict(pending);
      return;
    }
    doAdd(pending);
  };

  const isOpen = (menu.data?.restaurantStatus ?? restaurant?.status) === 'OPEN' && (restaurant?.isOpenNow ?? true);
  const reviews = (ratings.data ?? []).filter((r) => r.comment);

  if (menu.isPending) return <LoadingState label="Loading menu…" />;
  if (menu.error) return <div className="container page"><ErrorState error={menu.error} onRetry={() => menu.refetch()} /></div>;

  return (
    <>
      <section className="r-hero">
        <Art art={restaurantArt(cuisine, name)} src={restaurant?.logoUrl} />
        <div className="container r-hero__content">
          <Link to="/" className="back-link"><ArrowLeft size={16} /> All restaurants</Link>
          <div className="row row--wrap">
            <Badge tone={isOpen ? 'success' : 'solid'} dot>{isOpen ? 'Open now' : 'Closed'}</Badge>
            {cuisine && <Badge tone="solid">{cuisine}</Badge>}
          </div>
          <h1>{name}</h1>
          {restaurant?.description && <p>{restaurant.description}</p>}
          <div className="r-facts">
            {restaurant && Number(restaurant.averageRating) > 0 && (
              <span className="r-fact"><Star size={15} fill="#f6b443" color="#f6b443" /> {Number(restaurant.averageRating).toFixed(1)} · {ratings.data?.length ?? 0} reviews</span>
            )}
            {restaurant && <span className="r-fact"><Clock size={15} /> {restaurant.deliveryTimeMinutes}–{restaurant.deliveryTimeMinutes + 10} min</span>}
            <span className="r-fact"><Bike size={15} /> Min. {formatMoney(menu.data?.minimumOrderAmount ?? restaurant?.minimumOrderAmount)}</span>
            {restaurant?.address && <span className="r-fact"><MapPin size={15} /> {restaurant.address}</span>}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <nav className="cat-nav" aria-label="Menu sections">
          <div className="container cat-nav__inner">
            {categories.map((c) => (
              <button
                key={c.id}
                className={cx('cat-tab', activeCat === c.id && 'is-active')}
                onClick={() => {
                  setActiveCat(c.id);
                  sectionRefs.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {c.name} <small>{c.dishes.length}</small>
              </button>
            ))}
          </div>
        </nav>
      )}

      <div className="container page page--tight">
        {reviews.length > 0 && (
          <section aria-labelledby="reviews-title" style={{ marginBottom: 12 }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h2 id="reviews-title" style={{ fontSize: '1.1rem' }}>What people say</h2>
            </div>
            <div className="reviews">
              {reviews.map((r) => (
                <figure key={r.id} className="review">
                  <Stars value={r.score} />
                  <blockquote><p>“{r.comment}”</p></blockquote>
                  <figcaption className="tiny muted">Verified order</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {!isOpen && (
          <div className="notice" style={{ marginTop: 12 }}>
            <Clock size={16} /> This restaurant is closed right now. You can browse the menu, but ordering is paused.
          </div>
        )}

        {categories.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed size={28} />} title="No dishes yet">This restaurant hasn't published a menu.</EmptyState>
        ) : (
          categories.map((c) => (
            <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="menu-section">
              <h2>{c.name}</h2>
              {c.description && <p className="muted">{c.description}</p>}
              <div className="dish-grid">
                {c.dishes.map((d) => {
                  const available = d.status === 'AVAILABLE' && isOpen;
                  const inBag = qtyByDish.get(d.id);
                  return (
                    <button key={d.id} className="card card--hover dish" disabled={!available} onClick={() => setActiveDish(d)} id={`dish-${d.id}`}>
                      <div>
                        <h3>{d.name}</h3>
                        {d.description && <p className="dish__desc clamp-2">{d.description}</p>}
                        <div className="dish__foot">
                          <span className="dish__price">{formatMoney(d.price)}</span>
                          {d.optionGroups.length > 0 && <span className="chip">Customisable</span>}
                          {d.status !== 'AVAILABLE' && <Badge>Sold out</Badge>}
                        </div>
                      </div>
                      <span className="dish__media">
                        <Art art={dishArt(d.name, cuisine, name)} src={d.imageUrl} className="dish__art" />
                        {inBag ? <span className="dish__qty" aria-label={`${inBag} in bag`}>{inBag}</span> : null}
                        {available && <span className="dish__add" aria-hidden><Plus size={18} /></span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {cartCount > 0 && (
        <button className="cart-bar" onClick={drawer.open} id="open-cart-bar">
          <span className="cart-bar__count">{cartCount}</span>
          <span>View bag</span>
          <span className="cart-bar__go">
            {formatMoney(cartHere?.items.reduce((s, i) => s + i.subtotal, 0))} <ArrowRight size={16} />
          </span>
        </button>
      )}

      <DishOptionsModal
        dish={activeDish}
        cuisineHints={[cuisine, name]}
        onClose={() => setActiveDish(null)}
        onConfirm={handleConfirm}
        submitting={add.isPending}
      />

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="Start a new bag?"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setConflict(null)}>Keep current bag</button>
            <button className="btn btn--primary grow" disabled={add.isPending} onClick={() => conflict && doAdd(conflict, true)}>
              {add.isPending ? <Spinner /> : 'Clear bag & add'}
            </button>
          </>
        }
      >
        <p>
          Your bag already has dishes from <strong>{cart?.restaurantName}</strong>. An order can only come from one kitchen.
        </p>
        <button className="link-btn" style={{ marginTop: 12 }} onClick={() => { setConflict(null); navigate('/checkout'); }}>
          Check out that bag instead <ArrowRight size={14} />
        </button>
      </Modal>

      <Modal
        open={Boolean(needsCustomer)}
        onClose={() => setNeedsCustomer(null)}
        title="Order as the demo customer?"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setNeedsCustomer(null)}>Not now</button>
            <button
              className="btn btn--primary grow"
              disabled={switching !== null}
              onClick={async () => {
                const p = needsCustomer;
                if (p && (await switchTo('CUSTOMER', `/restaurant/${id}`))) {
                  setNeedsCustomer(null);
                  setActiveDish(p.dish);
                }
              }}
            >
              {switching ? <Spinner /> : 'Continue as customer'}
            </button>
          </>
        }
      >
        <p className="muted">
          {user ? 'Only customers can fill a bag. ' : ''}We'll sign you in as <strong style={{ color: 'var(--text)' }}>Hungry Customer</strong> — a seeded demo
          account — and reopen this dish.
        </p>
      </Modal>
    </>
  );
}
