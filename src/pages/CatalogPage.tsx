import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, Sparkles, X } from 'lucide-react';
import { useRestaurantSearch, useRestaurantTypes, useRestaurants } from '../hooks/queries';
import { RestaurantCard } from '../components/RestaurantCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui';
import { cx } from '../lib/format';
import { useAuth } from '../auth/AuthContext';

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q')?.trim() ?? '';
  const [typeId, setTypeId] = useState<number | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const { user } = useAuth();

  const all = useRestaurants();
  const search = useRestaurantSearch(keyword);
  const { data: types } = useRestaurantTypes();
  const active = keyword ? search : all;

  const typeName = (id?: number) => types?.find((t) => t.id === id)?.name;

  const restaurants = useMemo(
    () =>
      (active.data ?? []).filter(
        (r) => (typeId == null || r.typeId === typeId) && (!openOnly || (r.status === 'OPEN' && r.isOpenNow)),
      ),
    [active.data, typeId, openOnly],
  );

  return (
    <>
      <section className="hero">
        <img src="/images/hero.jpg" alt="" className="hero__img" />
        <div className="container hero__content">
          <span className="eyebrow"><Sparkles size={14} /> Fresh from UTown kitchens</span>
          <h1>
            Great food,<br />
            <span className="gradient-text">delivered fast.</span>
          </h1>
          <p className="hero__sub">
            {user ? `Hi ${user.name.split(' ')[0]} — what are you craving today?` : 'Order from the best local restaurants and track every step live.'}
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
            <input key={keyword} name="q" defaultValue={keyword} placeholder="Pizza, burgers, Demo Pizza Place…" aria-label="Search" id="hero-search" />
            <button className="btn btn--primary" type="submit">Search</button>
          </form>
        </div>
      </section>

      <section className="container section">
        <div className="toolbar">
          <div className="chips" role="tablist" aria-label="Cuisine">
            <button className={cx('chip-btn', typeId == null && 'is-active')} onClick={() => setTypeId(null)}>All</button>
            {types?.map((t) => (
              <button key={t.id} className={cx('chip-btn', typeId === t.id && 'is-active')} onClick={() => setTypeId(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
            <span className="switch__track" />
            Open now
          </label>
        </div>

        <div className="section-head">
          <h2>{keyword ? <>Results for “{keyword}”</> : 'Restaurants near you'}</h2>
          {keyword && (
            <button className="btn btn--text" onClick={() => setParams({})}>
              <X size={14} /> Clear search
            </button>
          )}
        </div>

        {active.isPending ? (
          <SkeletonGrid />
        ) : active.error ? (
          <ErrorState error={active.error} onRetry={() => active.refetch()} />
        ) : restaurants.length === 0 ? (
          <EmptyState icon={<SearchX size={28} />} title="No restaurants match">
            Try another keyword or cuisine.
          </EmptyState>
        ) : (
          <div className="grid grid--cards">
            {restaurants.map((r, i) => (
              <RestaurantCard key={r.id} r={r} typeName={typeName(r.typeId)} index={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
