import type { DeliveryAssignmentStatus, OrderStatus, PaymentMethod, UserRole } from '../types/api';

const CURRENCY = import.meta.env.VITE_CURRENCY || 'KRW';
const moneyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: CURRENCY === 'KRW' || CURRENCY === 'JPY' ? 0 : 2,
});

export const formatMoney = (amount: number | null | undefined) => moneyFmt.format(Number(amount ?? 0));

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  // Backend returns LocalDateTime in UTC without zone suffix.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const ORDER_FLOW: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const TERMINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'COMPLETED', 'DECLINED', 'CANCELLED'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  IN_PREPARATION: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
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
  CANCELLED: 'danger',
};

export const ASSIGNMENT_LABEL: Record<DeliveryAssignmentStatus, string> = {
  ASSIGNED: 'New assignment',
  ACCEPTED: 'Heading to restaurant',
  PICKED_UP: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const ASSIGNMENT_TONE: Record<DeliveryAssignmentStatus, Tone> = {
  ASSIGNED: 'warn',
  ACCEPTED: 'info',
  PICKED_UP: 'accent',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CARD: 'Card',
  CASH: 'Cash on delivery',
  BANK_TRANSFER: 'Bank transfer',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant owner',
  RIDER: 'Rider',
  ADMIN: 'Admin',
};

export const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: '/',
  RESTAURANT_OWNER: '/owner',
  RIDER: '/rider',
  ADMIN: '/admin',
};

/** Local editorial imagery, chosen by keyword, used when the API has no (working) image. */
const FALLBACK_IMAGES: [RegExp, string][] = [
  [/pizza|pepperoni|margherita|italian/i, '/images/pizza.jpg'],
  [/burger|fries|grill|american/i, '/images/burger.jpg'],
];

export function fallbackImage(...hints: (string | null | undefined)[]): string {
  const text = hints.filter(Boolean).join(' ');
  for (const [re, src] of FALLBACK_IMAGES) if (re.test(text)) return src;
  return '/images/bowl.jpg';
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
