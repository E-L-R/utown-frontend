import { Link } from 'react-router-dom';
import { Bike, Clock, Star } from 'lucide-react';
import type { RestaurantResponse } from '../types/api';
import { formatMoney, restaurantArt } from '../lib/format';
import { Art, Badge } from './ui';

export function RestaurantCard({ r, typeName, index = 0 }: { r: RestaurantResponse; typeName?: string; index?: number }) {
  const open = r.status === 'OPEN' && r.isOpenNow;
  const rating = Number(r.averageRating);
  return (
    <Link
      to={`/restaurant/${r.id}`}
      className="card card--hover rest-card"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      id={`restaurant-${r.id}`}
    >
      <Art art={restaurantArt(typeName, r.name)} src={r.logoUrl} alt={r.name} className="rest-card__media" />
      <div className="rest-card__body">
        <div className="rest-card__title">
          <h3 className="truncate">{r.name}</h3>
          {rating > 0 && (
            <span className="rating">
              <Star size={14} fill="currentColor" /> {rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="small muted clamp-2">{r.description || r.address}</p>
        <div className="rest-card__meta">
          {typeName && <span>{typeName}</span>}
          <span><Clock size={13} /> {r.deliveryTimeMinutes}–{r.deliveryTimeMinutes + 10} min</span>
          <span><Bike size={13} /> Min. {formatMoney(r.minimumOrderAmount)}</span>
          {!open && <Badge tone="neutral">Closed</Badge>}
        </div>
      </div>
    </Link>
  );
}
