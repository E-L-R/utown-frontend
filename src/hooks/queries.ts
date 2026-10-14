import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressApi, cartApi, deliveryApi, orderApi, restaurantApi, type OrderFilters } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import type { AddToCartRequest, CartResponse, OrderResponse } from '../types/api';
import { isLiveOrder } from '../lib/format';

export const qk = {
  restaurants: ['restaurants'] as const,
  types: ['restaurant-types'] as const,
  search: (kw: string) => ['search', kw] as const,
  menu: (id: number) => ['menu', id] as const,
  ratings: (id: number) => ['ratings', id] as const,
  cart: (userId?: number) => ['cart', userId] as const,
  orders: (f: OrderFilters) => ['orders', f] as const,
  order: (id: number) => ['order', id] as const,
  orderAssignments: (id: number) => ['order-assignments', id] as const,
  addresses: (userId?: number) => ['addresses', userId] as const,
  cities: ['cities'] as const,
  areas: (cityId?: number) => ['areas', cityId] as const,
  rider: (userId?: number) => ['rider', userId] as const,
  myAssignments: ['assignments', 'mine'] as const,
  allAssignments: ['assignments', 'all'] as const,
  riders: ['riders'] as const,
};

/** Re-renders every `ms` so elapsed timers stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

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

export const useRatings = (id: number) =>
  useQuery({ queryKey: qk.ratings(id), queryFn: () => restaurantApi.ratings(id), enabled: Number.isFinite(id), staleTime: 60_000 });

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
    if (!user) throw new Error('Please sign in as a customer to use the bag.');
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

/**
 * Rebuilds a past order in the bag. Order items only carry option *names*, so we map them back
 * to option ids through the restaurant's current menu.
 */
export function useReorder() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: OrderResponse) => {
      if (!user) throw new Error('Sign in as a customer to reorder.');
      const menu = await qc.fetchQuery({ queryKey: qk.menu(order.restaurantId), queryFn: () => restaurantApi.menu(order.restaurantId) });
      const dishes = new Map(menu.categories.flatMap((c) => c.dishes).map((d) => [d.id, d]));
      let cart: CartResponse | undefined;
      let skipped = 0;
      for (const [i, item] of order.items.entries()) {
        const dish = dishes.get(item.dishId);
        if (!dish || dish.status !== 'AVAILABLE') {
          skipped++;
          continue;
        }
        const wanted = new Set((item.options ?? []).map((o) => o.optionName));
        const optionIds = dish.optionGroups.flatMap((g) => g.options.filter((o) => wanted.has(o.name)).map((o) => o.id));
        cart = await cartApi.add(
          user.id,
          { restaurantId: order.restaurantId, dishId: item.dishId, quantity: item.quantity, optionIds },
          i === 0 || !cart,
        );
      }
      if (!cart) throw new Error('None of these dishes are available right now.');
      qc.setQueryData(qk.cart(user.id), cart);
      return { cart, skipped };
    },
  });
}

// ---------- Orders ----------
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
    refetchInterval: (q) => (q.state.data && isLiveOrder(q.state.data.status) ? 5_000 : false),
  });

/** Who is delivering an order (customer, owner and admin can see this). */
export const useOrderAssignments = (order?: OrderResponse) =>
  useQuery({
    queryKey: qk.orderAssignments(order?.id ?? -1),
    queryFn: () => deliveryApi.forOrder(order!.id),
    enabled: Boolean(order),
    refetchInterval: order && isLiveOrder(order.status) ? 5_000 : false,
    retry: false,
  });

/** Invalidate everything order-shaped after a status transition. */
export function useInvalidateOrders() {
  const qc = useQueryClient();
  return (order?: OrderResponse) => {
    if (order) qc.setQueryData(qk.order(order.id), order);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['assignments'] });
    qc.invalidateQueries({ queryKey: ['order-assignments'] });
  };
}

// ---------- Addresses ----------
export function useAddresses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.addresses(user?.id),
    queryFn: () => addressApi.listForUser(user!.id),
    enabled: user?.role === 'CUSTOMER',
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

// ---------- Riders & dispatch ----------
export function useRiderProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.rider(user?.id),
    queryFn: () => deliveryApi.riderByUser(user!.id),
    enabled: user?.role === 'RIDER',
  });
}

export const useMyAssignments = (enabled: boolean) =>
  useQuery({ queryKey: qk.myAssignments, queryFn: deliveryApi.mine, enabled, refetchInterval: 5_000 });

export const useAllAssignments = (enabled = true) =>
  useQuery({ queryKey: qk.allAssignments, queryFn: () => deliveryApi.list(), enabled, refetchInterval: 8_000 });

export const useRiders = (enabled = true) =>
  useQuery({ queryKey: qk.riders, queryFn: () => deliveryApi.riders(), enabled, refetchInterval: 10_000 });
