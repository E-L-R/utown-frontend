import { apiClient } from './client';
import type {
  AddToCartRequest,
  AddressRequest,
  AddressResponse,
  AuthResponse,
  CartResponse,
  CheckoutRequest,
  CityResponse,
  DeliveryAreaResponse,
  DeliveryAssignmentRequest,
  DeliveryAssignmentResponse,
  LoginRequest,
  OrderResponse,
  OrderStatus,
  PageResponse,
  RatingRequest,
  RatingResponse,
  RestaurantMenuResponse,
  RestaurantResponse,
  RestaurantTypeResponse,
  RiderProfileResponse,
  UserProfileResponse,
} from '../types/api';

const get = <T>(url: string, params?: object) => apiClient.get<T>(url, { params }).then((r) => r.data);

// ---------- Auth ----------
export const authApi = {
  login: (body: LoginRequest) => apiClient.post<AuthResponse>('/api/auth/login', body).then((r) => r.data),
  me: () => get<UserProfileResponse>('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout').catch(() => undefined),
};

// ---------- Restaurants ----------
export const restaurantApi = {
  list: () => get<RestaurantResponse[]>('/api/restaurants'),
  types: () => get<RestaurantTypeResponse[]>('/api/restaurant-types'),
  menu: (id: number) => get<RestaurantMenuResponse>(`/api/restaurants/${id}/menu`),
  search: (keyword: string) =>
    get<PageResponse<RestaurantResponse>>('/api/search', { keyword, page: 0, size: 50 }),
};

// ---------- Cart ----------
export const cartApi = {
  get: (userId: number) => get<CartResponse>('/api/cart', { userId }),
  add: (userId: number, body: AddToCartRequest, clearExisting = false) =>
    apiClient
      .post<CartResponse>('/api/cart/items', body, { params: { userId, clearExisting } })
      .then((r) => r.data),
  update: (userId: number, itemId: number, quantity: number) =>
    apiClient
      .put<CartResponse>(`/api/cart/items/${itemId}`, { quantity }, { params: { userId } })
      .then((r) => r.data),
  remove: (userId: number, itemId: number) =>
    apiClient.delete<CartResponse>(`/api/cart/items/${itemId}`, { params: { userId } }).then((r) => r.data),
  clear: (userId: number) => apiClient.delete('/api/cart', { params: { userId } }),
};

// ---------- Orders ----------
export interface OrderFilters {
  userId?: number;
  restaurantId?: number;
  status?: OrderStatus;
}

export const orderApi = {
  checkout: (body: CheckoutRequest) =>
    apiClient.post<OrderResponse>('/api/orders/checkout', body).then((r) => r.data),
  list: (filters: OrderFilters = {}) => get<OrderResponse[]>('/api/orders', filters),
  get: (id: number) => get<OrderResponse>(`/api/orders/${id}`),
  accept: (id: number, estimatedCookingMinutes: number) =>
    apiClient.patch<OrderResponse>(`/api/orders/${id}/accept`, { estimatedCookingMinutes }).then((r) => r.data),
  decline: (id: number, reason: string) =>
    apiClient.patch<OrderResponse>(`/api/orders/${id}/decline`, { reason }).then((r) => r.data),
  prepare: (id: number) => apiClient.patch<OrderResponse>(`/api/orders/${id}/prepare`).then((r) => r.data),
  ready: (id: number) => apiClient.patch<OrderResponse>(`/api/orders/${id}/ready`).then((r) => r.data),
  cancel: (id: number, reason: string) =>
    apiClient.patch<OrderResponse>(`/api/orders/${id}/cancel`, { reason }).then((r) => r.data),
  rate: (id: number, body: RatingRequest) =>
    apiClient.post<RatingResponse>(`/api/orders/${id}/ratings`, body).then((r) => r.data),
};

// ---------- Addresses & geography ----------
export const addressApi = {
  listForUser: (userId: number) => get<AddressResponse[]>(`/api/addresses/user/${userId}`),
  create: (body: AddressRequest) => apiClient.post<AddressResponse>('/api/addresses', body).then((r) => r.data),
  cities: () => get<CityResponse[]>('/api/cities'),
  areasForCity: (cityId: number) => get<DeliveryAreaResponse[]>(`/api/delivery-areas/city/${cityId}`),
};

// ---------- Riders & deliveries ----------
export const deliveryApi = {
  /** Admin-only on the live backend (riders receive 403). */
  list: (params: { riderId?: number; orderId?: number; status?: string } = {}) =>
    get<DeliveryAssignmentResponse[]>('/api/delivery-assignments', params),
  get: (id: number) => get<DeliveryAssignmentResponse>(`/api/delivery-assignments/${id}`),
  create: (body: DeliveryAssignmentRequest) =>
    apiClient.post<DeliveryAssignmentResponse>('/api/delivery-assignments', body).then((r) => r.data),
  accept: (id: number) =>
    apiClient.patch<DeliveryAssignmentResponse>(`/api/delivery-assignments/${id}/accept`).then((r) => r.data),
  pickup: (id: number) =>
    apiClient.patch<DeliveryAssignmentResponse>(`/api/delivery-assignments/${id}/pickup`).then((r) => r.data),
  deliver: (id: number) =>
    apiClient.patch<DeliveryAssignmentResponse>(`/api/delivery-assignments/${id}/deliver`).then((r) => r.data),
  riderByUser: (userId: number) => get<RiderProfileResponse>(`/api/riders/user/${userId}`),
  riders: (params: { availability?: boolean } = {}) => get<RiderProfileResponse[]>('/api/riders', params),
};
