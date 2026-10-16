import {
  Beef, Citrus, Coffee, Cookie, CookingPot, Croissant, CupSoda, Drumstick, EggFried, Fish, Hamburger,
  IceCreamBowl, Pizza, Salad, Soup, UtensilsCrossed, Wheat, type LucideIcon,
} from 'lucide-react';
import type { DeliveryAssignmentStatus, OrderStatus, PaymentMethod, TransportType, UserRole } from '../types/api';

const CURRENCY = import.meta.env.VITE_CURRENCY || 'KRW';
const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: CURRENCY === 'KRW' || CURRENCY === 'JPY' ? 0 : 2,
});

export const formatMoney = (amount: number | null | undefined) => moneyFmt.format(Number(amount ?? 0));

/** Backend sends LocalDateTime in UTC without a zone suffix. */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value?: string | null): string {
  const d = parseServerDate(value);
  if (!d) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(value?: string | null): string {
  const d = parseServerDate(value);
  return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';
}

export function formatDay(value?: string | null): string {
  const d = parseServerDate(value);
  if (!d) return '—';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Whole minutes elapsed since a server timestamp. */
export function minutesSince(value?: string | null, now = Date.now()): number | null {
  const d = parseServerDate(value);
  return d ? Math.max(0, Math.floor((now - d.getTime()) / 60_000)) : null;
}

export function timeAgo(value?: string | null, now = Date.now()): string {
  const m = minutesSince(value, now);
  if (m == null) return '';
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDay(value);
}

export const shortOrderNo = (orderNumber?: string | null, id?: number) =>
  orderNumber ? orderNumber.slice(-6).toUpperCase() : String(id ?? '');

// ---------- Order lifecycle ----------

export const ORDER_FLOW: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const TERMINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'COMPLETED', 'DECLINED', 'CANCELLED'];
export const isLiveOrder = (s: OrderStatus) => !TERMINAL_STATUSES.includes(s);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Waiting for restaurant',
  ACCEPTED: 'Accepted',
  IN_PREPARATION: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

/** Short labels for steppers and kitchen tickets. */
export const ORDER_STEP_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Placed',
  ACCEPTED: 'Accepted',
  IN_PREPARATION: 'Cooking',
  READY_FOR_PICKUP: 'Ready',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

/** Customer-facing headline + subline for the live tracking hero. */
export const ORDER_STATUS_COPY: Record<OrderStatus, [string, string]> = {
  PENDING: ['Sending your order to the kitchen', 'The restaurant will confirm in a moment.'],
  ACCEPTED: ['Order confirmed', 'The kitchen has your order and is getting started.'],
  IN_PREPARATION: ['Your food is being prepared', 'Fresh from the kitchen, made to order.'],
  READY_FOR_PICKUP: ['Packed and ready', 'Waiting for your rider to collect it.'],
  OUT_FOR_DELIVERY: ['Your rider is on the way', 'Keep your phone handy — almost there.'],
  DELIVERED: ['Delivered. Enjoy your meal!', 'Thanks for ordering with UTown.'],
  COMPLETED: ['Order complete', 'Thanks for ordering with UTown.'],
  DECLINED: ['The restaurant couldn’t take this order', 'You have not been charged for a declined order.'],
  CANCELLED: ['Order cancelled', 'This order will not be delivered.'],
};

export type Tone = 'neutral' | 'info' | 'warn' | 'success' | 'danger' | 'accent';

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'warn',
  ACCEPTED: 'info',
  IN_PREPARATION: 'accent',
  READY_FOR_PICKUP: 'accent',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'neutral',
};

export const ASSIGNMENT_LABEL: Record<DeliveryAssignmentStatus, string> = {
  ASSIGNED: 'New job',
  ACCEPTED: 'Heading to restaurant',
  PICKED_UP: 'Delivering',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const ASSIGNMENT_TONE: Record<DeliveryAssignmentStatus, Tone> = {
  ASSIGNED: 'warn',
  ACCEPTED: 'info',
  PICKED_UP: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
};

export const ACTIVE_ASSIGNMENT: DeliveryAssignmentStatus[] = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP'];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: 'Card',
  CASH: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

export const TRANSPORT_LABEL: Record<TransportType, string> = {
  MOTORCYCLE: 'Scooter',
  BICYCLE: 'Bicycle',
  CAR: 'Car',
  WALK: 'On foot',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant owner',
  RIDER: 'Rider',
  ADMIN: 'Operations',
};

export const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: '/',
  RESTAURANT_OWNER: '/kitchen',
  RIDER: '/rider',
  ADMIN: '/ops',
};

// ---------- Artwork ----------
// The demo backend has no real photography, so we pair a handful of local photos with a plain
// tile carrying an outline icon. Photos are only used when they match.

export interface Art {
  photo?: string;
  icon: LucideIcon;
}

const CUISINES: { re: RegExp; art: Art }[] = [
  { re: /pizza|pizzeria|margherita|pepperoni|funghi/i, art: { photo: '/images/pizza.webp', icon: Pizza } },
  { re: /burger|smash/i, art: { photo: '/images/burger.webp', icon: Hamburger } },
  { re: /sushi|nigiri|japanese|maki|dragon roll|tuna roll/i, art: { photo: '/images/sushi.webp', icon: Fish } },
  { re: /noodle|ramen|naengmyeon|jjajang|kalguksu|jjamppong|udon/i, art: { photo: '/images/noodles.webp', icon: Soup } },
  { re: /bowl|bibimbap|korean|bulgogi/i, art: { photo: '/images/bowl.webp', icon: CookingPot } },
  { re: /chicken|wing/i, art: { icon: Drumstick } },
  { re: /caf[eé]|dessert|bingsu|coffee/i, art: { icon: Coffee } },
];

const DISH_ICON: [RegExp, LucideIcon][] = [
  [/salad/i, Salad],
  [/lemonade|lemon/i, Citrus],
  [/knot|bread/i, Wheat],
  [/shake/i, CupSoda],
  [/wing|chicken/i, Drumstick],
  [/cheese ball/i, Cookie],
  [/fried rice/i, EggFried],
  [/japchae/i, Soup],
  [/pajeon|pancake/i, EggFried],
  [/bingsu/i, IceCreamBowl],
  [/croffle|waffle/i, Croissant],
  [/latte|coffee|espresso|dalgona/i, Coffee],
  [/beef|bulgogi/i, Beef],
];

/** Artwork for a restaurant, from its cuisine type and name. */
export function restaurantArt(...hints: (string | null | undefined)[]): Art {
  const text = hints.filter(Boolean).join(' ');
  return CUISINES.find((c) => c.re.test(text))?.art ?? { icon: UtensilsCrossed };
}

/** Artwork for a dish: a photo only when the dish itself matches; otherwise an icon tile. */
export function dishArt(name: string, ...cuisineHints: (string | null | undefined)[]): Art {
  const base = restaurantArt(...cuisineHints);
  const icon = DISH_ICON.find(([re]) => re.test(name))?.[1];
  if (icon) return { icon };
  const own = CUISINES.find((c) => c.re.test(name))?.art;
  return own ?? { icon: base.icon };
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
