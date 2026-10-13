import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressApi, cartApi, deliveryApi, orderApi, restaurantApi, type OrderFilters } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import type { AddToCartRequest, CartResponse, OrderResponse } from '../types/api';
import { TERMINAL_STATUSES } from '../lib/format';

export const qk = {
  restaurants: ['restaurants'] as const,
  types: ['restaurant-types'] as const,
  search: (kw: string) => ['search', kw] as const,
  menu: (id: number) => ['menu', id] as const,
  cart: (userId?: number) => ['cart', userId] as const,
  orders: (f: OrderFilters) => ['orders', f] as const,
  order: (id: number) => ['order', id] as const,
  addresses: (userId?: number) => ['addresses', userId] as const,
  cities: ['cities'] as const,
  areas: (cityId?: number) => ['areas', cityId] as const,
  rider: (userId?: number) => ['rider', userId] as const,
  assignment: (id: number) => ['assignment', id] as const,
};

// ---------- Catalog ----------
export const useRestaurants = () =>
  useQuery({ queryKey: qk.restaurants, queryFn: restaurantApi.list, staleTime: 60_000 });

export const useRestaurantTypes = () =>
  useQuery({ queryKey: qk.types, queryFn: restaurantApi.types, staleTime: 10 * 60_000 });

export const useRestaurantSearch = (keyword: string) =>
  useQuery({
    queryKey: qk.search(keyword),
    queryFn: () => restaurantApi.search(keyword),
    enabled: keyword.trim().length > 0,
    staleTime: 30_000,
    select: (page) => page.content,
  });

export const useMenu = (id: number) =>
  useQuery({ queryKey: qk.menu(id), queryFn: () => restaurantApi.menu(id), enabled: Number.isFinite(id) });

// ---------- Cart ----------
export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.cart(user?.id),
    queryFn: () => cartApi.get(user!.id),
    enabled: user?.role === 'CUSTOMER',
  });
}

export function useCartMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = qk.cart(user?.id);
  const setCart = (cart: CartResponse) => qc.setQueryData(key, cart);
  const uid = () => {
    if (!user) throw new Error('Please sign in as a customer to use the cart.');
    return user.id;
  };

  const add = useMutation({
    mutationFn: ({ body, clearExisting }: { body: AddToCartRequest; clearExisting?: boolean }) =>
      cartApi.add(uid(), body, clearExisting),
    onSuccess: setCart,
  });

  const update = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      cartApi.update(uid(), itemId, quantity),
    // Optimistic quantity bump for snappy steppers.
    onMutate: async ({ itemId, quantity }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CartResponse>(key);
      if (prev) {
        qc.setQueryData<CartResponse>(key, {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, quantity, subtotal: (i.subtotal / i.quantity) * quantity } : i,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSuccess: setCart,
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => cartApi.remove(uid(), itemId),
    onSuccess: setCart,
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const clear = useMutation({
    mutationFn: () => cartApi.clear(uid()),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { add, update, remove, clear };
}

// ---------- Orders ----------
const isLive = (o?: OrderResponse) => Boolean(o && !TERMINAL_STATUSES.includes(o.status));

export const useOrders = (filters: OrderFilters, opts: { enabled?: boolean; poll?: number } = {}) =>
  useQuery({
    queryKey: qk.orders(filters),
    queryFn: () => orderApi.list(filters),
    enabled: opts.enabled ?? true,
    refetchInterval: opts.poll,
    select: (orders) => [...orders].sort((a, b) => b.id - a.id),
  });

export const useOrder = (id: number) =>
  useQuery({
    queryKey: qk.order(id),
    queryFn: () => orderApi.get(id),
    enabled: Number.isFinite(id),
    // Live tracking: poll until the order reaches a terminal state.
    refetchInterval: (q) => (isLive(q.state.data) ? 8_000 : false),
  });

/** Invalidate everything order-shaped after a status transition. */
export function useInvalidateOrders() {
  const qc = useQueryClient();
  return (order?: OrderResponse) => {
    if (order) qc.setQueryData(qk.order(order.id), order);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };
}

// ---------- Addresses ----------
export function useAddresses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.addresses(user?.id),
    queryFn: () => addressApi.listForUser(user!.id),
    enabled: Boolean(user),
  });
}

export const useCities = () => useQuery({ queryKey: qk.cities, queryFn: addressApi.cities, staleTime: Infinity });

export const useAreas = (cityId?: number) =>
  useQuery({
    queryKey: qk.areas(cityId),
    queryFn: () => addressApi.areasForCity(cityId!),
    enabled: Boolean(cityId),
    staleTime: Infinity,
  });

// ---------- Rider ----------
export function useRiderProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.rider(user?.id),
    queryFn: () => deliveryApi.riderByUser(user!.id),
    enabled: user?.role === 'RIDER',
  });
}
