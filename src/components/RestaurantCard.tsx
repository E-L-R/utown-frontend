import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import type { RestaurantResponse } from '../types/api';
import { formatMoney } from '../lib/format';
import { Badge, SmartImage } from './ui';

export function RestaurantCard({ r, typeName, index = 0 }: { r: RestaurantResponse; typeName?: string; index?: number }) {
  const open = r.status === 'OPEN' && r.isOpenNow;
  return (
    <Link
      to={`/restaurant/${r.id}`}
      className="card restaurant-card"
      style={{ animationDelay: `${index * 60}ms` }}
      id={`restaurant-${r.id}`}
    >
      <div className="restaurant-card__media">
        <SmartImage src={r.logoUrl} alt={r.name} hints={[typeName, r.description]} />
        <div className="restaurant-card__badges">
          <Badge tone={open ? 'success' : 'neutral'} dot>
            {open ? 'Open' : 'Closed'}
          </Badge>
        </div>
        <span className="restaurant-card__eta">
          <Clock size={13} /> {r.deliveryTimeMinutes}–{r.deliveryTimeMinutes + 10} min
        </span>
      </div>
      <div className="restaurant-card__body">
        <div className="row-between">
          <h3>{r.name}</h3>
          <span className="rating">
            <Star size={13} fill="currentColor" /> {Number(r.averageRating).toFixed(1)}
          </span>
        </div>
        <p className="muted small line-clamp">{r.description || r.address}</p>
        <div className="meta">
          {typeName && <span>{typeName}</span>}
          <span>Min. {formatMoney(r.minimumOrderAmount)}</span>
        </div>
      </div>
    </Link>
  );
}
