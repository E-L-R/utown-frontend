import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Bike, ChefHat, LayoutDashboard, Search, SearchX, Sparkles, UserRound, X } from 'lucide-react';
import { useOrders, useRestaurantSearch, useRestaurantTypes, useRestaurants } from '../hooks/queries';
import { useAuth } from '../auth/AuthContext';
import { useSwitchRole } from '../auth/useSwitchRole';
import { RestaurantCard } from '../components/RestaurantCard';
import { orderProgress, statusIcon } from '../components/OrderProgress';
import { Art, EmptyState, ErrorState, SkeletonGrid, Spinner, useDocumentTitle } from '../components/ui';
import { ORDER_STATUS_LABEL, cx, isLiveOrder, restaurantArt } from '../lib/format';
import type { RestaurantResponse, UserRole } from '../types/api';

type Sort = 'recommended' | 'rating' | 'fastest' | 'minimum';

const SORTS: Record<Sort, { label: string; fn: (a: RestaurantResponse, b: RestaurantResponse) => number }> = {
  recommended: { label: 'Recommended', fn: (a, b) => Number(b.isOpenNow) - Number(a.isOpenNow) || Number(b.averageRating) - Number(a.averageRating) },
  rating: { label: 'Top rated', fn: (a, b) => Number(b.averageRating) - Number(a.averageRating) },
  fastest: { label: 'Fastest delivery', fn: (a, b) => a.deliveryTimeMinutes - b.deliveryTimeMinutes },
  minimum: { label: 'Lowest minimum', fn: (a, b) => a.minimumOrderAmount - b.minimumOrderAmount },
};

function LiveOrderBanner() {
  const { user } = useAuth();
  const { data: orders } = useOrders({ userId: user?.id }, { enabled: user?.role === 'CUSTOMER', poll: 10_000 });
  const live = orders?.find((o) => isLiveOrder(o.status));
  if (!live) return null;
  const Icon = statusIcon(live.status);
  return (
    <Link to={`/orders/${live.id}`} className="live-banner" id="live-order-banner">
      <span className="live-banner__icon"><Icon size={22} /></span>
      <span className="grow">
        <span className="tiny muted strong" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live order</span>
        <strong style={{ display: 'block' }}>
          {ORDER_STATUS_LABEL[live.status]} · {live.restaurantName ?? 'Your order'}
        </strong>
        <div className="meter"><span style={{ width: `${Math.max(6, orderProgress(live.status) * 100)}%` }} /></div>
      </span>
      <span className="link-btn">Track <ArrowRight size={16} /></span>
    </Link>
  );
}

const HOW: { role: UserRole; icon: typeof UserRound; title: string; body: string }[] = [
  { role: 'CUSTOMER', icon: UserRound, title: 'Customer', body: 'Browse menus, customise dishes, check out and follow the order live.' },
  { role: 'RESTAURANT_OWNER', icon: ChefHat, title: 'Restaurant', body: 'A kitchen board: accept tickets, set prep time, cook, call a rider.' },
  { role: 'RIDER', icon: Bike, title: 'Rider', body: 'Go online, accept a job, pick it up and mark it delivered.' },
  { role: 'ADMIN', icon: LayoutDashboard, title: 'Operations', body: 'Platform KPIs, a dispatch queue and the whole rider fleet.' },
];

function HowItWorks() {
  const { user } = useAuth();
  const { switchTo, pending } = useSwitchRole();
  return (
    <section className="how" aria-labelledby="how-title">
      <span className="eyebrow"><Sparkles size={14} /> Portfolio demo</span>
      <h2 id="how-title" style={{ fontSize: '1.7rem', marginTop: 8 }}>One order, four apps</h2>
      <p className="muted" style={{ maxWidth: 620, marginTop: 6 }}>
        UTown is a working delivery marketplace. Every role below is a real account on the Spring Boot API, so you can place an order and push it
        through the kitchen, dispatch and delivery yourself.
      </p>
      <div className="how__grid">
        {HOW.map((h, i) => (
          <button key={h.role} className="how-step" disabled={pending !== null} onClick={() => switchTo(h.role)}>
            <span className="how-step__n">0{i + 1}</span>
            <span className={cx('role-icon', `role--${h.role.toLowerCase()}`)}>
              {pending === h.role ? <Spinner size={16} /> : <h.icon size={18} />}
            </span>
            <strong>{h.title}</strong>
            <p>{h.body}</p>
            <span className="link-btn">{user?.role === h.role ? "You're here" : `Try as ${h.title.toLowerCase()}`} <ArrowRight size={14} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q')?.trim() ?? '';
  const [typeId, setTypeId] = useState<number | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('recommended');
  const { user } = useAuth();
  useDocumentTitle(keyword ? `“${keyword}”` : undefined);

  const all = useRestaurants();
  const search = useRestaurantSearch(keyword);
  const { data: types } = useRestaurantTypes();

  const typeName = (id?: number) => types?.find((t) => t.id === id)?.name;

  const restaurants = useMemo(() => {
    let list = all.data ?? [];
    if (keyword) {
      // Server search covers dish names; also match on name/cuisine locally so partial words work.
      const ids = new Set((search.data ?? []).map((r) => r.id));
      const k = keyword.toLowerCase();
      list = list.filter((r) => ids.has(r.id) || r.name.toLowerCase().includes(k) || typeName(r.typeId)?.toLowerCase().includes(k));
    }
    return list
      .filter((r) => (typeId == null || r.typeId === typeId) && (!openOnly || (r.status === 'OPEN' && r.isOpenNow)))
      .sort(SORTS[sort].fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.data, search.data, keyword, typeId, openOnly, sort, types]);

  const usedTypes = types?.filter((t) => all.data?.some((r) => r.typeId === t.id)) ?? [];
  const openCount = all.data?.filter((r) => r.status === 'OPEN' && r.isOpenNow).length ?? 0;
  const loading = all.isPending || (keyword && search.isPending);

  return (
    <div className="container">
      <section className="hero">
        <img src="/images/hero.webp" alt="" className="hero__img" fetchPriority="high" />
        <div className="hero__content">
          <span className="eyebrow"><Sparkles size={14} /> Seoul · delivered in ~30 min</span>
          <h1>
            Seoul's best kitchens,
            <br />
            <span>at your door.</span>
          </h1>
          <p className="hero__sub">
            {user?.role === 'CUSTOMER'
              ? `Hi ${user.name.split(' ')[0]} — what are you craving today?`
              : 'Order from local favourites and watch every step — kitchen, rider, doorstep — in real time.'}
          </p>
          <form
            className="hero__search"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get('q')?.toString().trim();
              setParams(v ? { q: v } : {});
            }}
          >
            <Search size={18} />
            <input key={keyword} name="q" defaultValue={keyword} placeholder="Try “bibimbap”, “pizza” or “chicken”" aria-label="Search" id="hero-search" />
            <button className="btn btn--primary" type="submit">Search</button>
          </form>
          <div className="hero__stats">
            <div><strong>{all.data?.length ?? '—'}</strong><span>restaurants</span></div>
            <div><strong>{openCount || '—'}</strong><span>open right now</span></div>
            <div><strong>4</strong><span>roles to try</span></div>
          </div>
        </div>
      </section>

      {user?.role === 'CUSTOMER' && <LiveOrderBanner />}

      <section className="section" aria-label="Cuisines">
        <div className="cuisine-rail">
          <button className={cx('cuisine', typeId == null && 'is-active')} onClick={() => setTypeId(null)}>
            <Art art={{ emoji: '✨', hue: 24 }} className="cuisine__emoji" />
            All
          </button>
          {usedTypes.map((t) => (
            <button key={t.id} className={cx('cuisine', typeId === t.id && 'is-active')} onClick={() => setTypeId(typeId === t.id ? null : t.id)}>
              <Art art={{ ...restaurantArt(t.name), photo: undefined }} className="cuisine__emoji" />
              <span className="truncate" style={{ maxWidth: '100%' }}>{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" style={{ marginTop: 20 }}>
        <div className="section-head">
          <div>
            <h2>{keyword ? <>Results for “{keyword}”</> : typeId ? `${typeName(typeId)} near you` : 'Restaurants near you'}</h2>
            {!loading && <p>{restaurants.length} {restaurants.length === 1 ? 'place' : 'places'} delivering across Seoul</p>}
          </div>
          <div className="row row--wrap">
            {keyword && (
              <button className="btn btn--ghost btn--sm" onClick={() => setParams({})}>
                <X size={14} /> Clear search
              </button>
            )}
            <label className="switch">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              <span className="switch__track" />
              Open now
            </label>
            <select className="select" style={{ width: 'auto', minHeight: 38, borderRadius: 999, fontWeight: 600, fontSize: 14, paddingTop: 6, paddingBottom: 6 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort restaurants">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : all.error ? (
          <ErrorState error={all.error} onRetry={() => all.refetch()} />
        ) : restaurants.length === 0 ? (
          <EmptyState icon={<SearchX size={28} />} title="Nothing matches yet" boxed>
            <p>Try another dish or cuisine, or turn off “Open now”.</p>
          </EmptyState>
        ) : (
          <div className="rest-grid">
            {restaurants.map((r, i) => (
              <RestaurantCard key={r.id} r={r} typeName={typeName(r.typeId)} index={i} />
            ))}
          </div>
        )}
      </section>

      {!keyword && <HowItWorks />}
    </div>
  );
}
