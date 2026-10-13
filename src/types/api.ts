// TypeScript contracts for the UTown Food Delivery API.
// Reconciled against the live OpenAPI 3.1 doc (`/v3/api-docs`) and real responses.
// Where the backend differs from the original spec, the backend wins and it is noted with "NOTE(backend)".

// ==========================================
// 1. ENUMS & LITERAL TYPES
// ==========================================

export type UserRole = 'ADMIN' | 'CUSTOMER' | 'RESTAURANT_OWNER' | 'RIDER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type RestaurantStatus = 'OPEN' | 'CLOSED';
export type DishStatus = 'AVAILABLE' | 'ON_HOLD';
export type DishOptionStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type CartStatus = 'ACTIVE' | 'EXPIRED';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PREPARATION'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED';

export type PaymentMethod = 'CARD' | 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type TransportType = 'BICYCLE' | 'CAR' | 'MOTORCYCLE' | 'WALK';
export type DeliveryAssignmentStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED';

export type NotificationType = 'NEW_ORDER' | 'ORDER_STATUS_CHANGED' | 'SYSTEM';
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

// ==========================================
// 2. AUTH & USER TYPES
// ==========================================

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface UserProfileResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
}

export interface UserProfileUpdateRequest {
  name?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ==========================================
// 3. RESTAURANT & MENU TYPES
// ==========================================

export interface RestaurantResponse {
  id: number;
  name: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  minimumOrderAmount: number;
  status: RestaurantStatus;
  isOpenNow: boolean;
  averageRating: number;
  deliveryTimeMinutes: number;
  ownerId?: number;
  typeId?: number;
  cityId?: number;
}

export interface RestaurantTypeResponse {
  id: number;
  name: string;
  description?: string | null;
}

export interface WorkingHours {
  dayOfWeek: DayOfWeek;
  openTime?: string;
  closeTime?: string;
  isDayOff: boolean;
}

export interface RestaurantMenuResponse {
  restaurantId: number;
  // NOTE(backend): the menu endpoint also returns these summary fields.
  restaurantName?: string;
  restaurantStatus?: RestaurantStatus;
  minimumOrderAmount?: number;
  categories: MenuCategory[];
}

export interface MenuCategory {
  id: number;
  name: string;
  description?: string | null;
  priority?: number | null;
  dishes: MenuDish[];
}

export interface MenuDish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  status: DishStatus;
  optionGroups: MenuOptionGroup[];
}

export interface MenuOptionGroup {
  id: number;
  name: string;
  required: boolean;
  minSelections?: number | null;
  maxSelections?: number | null;
  options: MenuOption[];
}

export interface MenuOption {
  id: number;
  name: string;
  additionalPrice: number;
  status: DishOptionStatus;
}

// ==========================================
// 4. CART TYPES
// ==========================================

export interface CartResponse {
  // NOTE(backend): id / restaurantId are null for an empty cart.
  id: number | null;
  userId: number;
  restaurantId: number | null;
  restaurantName?: string | null;
  status: CartStatus;
  totalAmount: number;
  totalItems: number;
  items: CartItemResponse[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CartItemResponse {
  id: number;
  dishId: number;
  dishName: string;
  dishImageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  // NOTE(backend): field is `options` (spec said `selectedOptions`).
  options?: CartItemOptionResponse[];
}

export interface CartItemOptionResponse {
  id: number;
  dishOptionId: number;
  optionName: string;
  optionPrice: number;
}

export interface AddToCartRequest {
  restaurantId: number;
  dishId: number;
  quantity: number;
  // NOTE(backend): field is `optionIds` (spec said `selectedOptionIds`).
  optionIds?: number[];
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface CheckoutRequest {
  userId?: number;
  addressId: number;
  paymentMethod: PaymentMethod;
  deliveryNote?: string;
}

// ==========================================
// 5. ORDER & PAYMENT TYPES
// ==========================================

export interface OrderResponse {
  id: number;
  orderNumber: string;
  userId: number;
  restaurantId: number;
  addressId: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  deliveryNote?: string | null;
  rejectionReason?: string | null;
  estimatedCookingMinutes?: number | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  items: OrderItemResponse[];
}

export interface OrderItemResponse {
  id: number;
  dishId: number;
  dishName: string;
  unitPrice: number;
  quantity: number;
  // NOTE(backend): order items use `subTotal` (camel-case T), unlike cart items.
  subTotal: number;
  options?: OrderItemOptionResponse[];
}

export interface OrderItemOptionResponse {
  id: number;
  dishOptionId?: number;
  optionName: string;
  optionPrice: number;
}

export interface OrderAcceptRequest {
  estimatedCookingMinutes: number;
}

// NOTE(backend): decline & cancel both take `{ reason }` (required).
export interface OrderDeclineRequest {
  reason: string;
}

export interface OrderCancelRequest {
  reason: string;
}

// ==========================================
// 6. ADDRESS & GEOGRAPHY TYPES
// ==========================================

export interface AddressResponse {
  id: number;
  userId: number;
  cityId: number;
  deliveryAreaId: number;
  recipientName: string;
  phone?: string | null;
  addressLine: string;
  postalCode?: string | null;
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AddressRequest {
  userId: number;
  cityId: number;
  deliveryAreaId: number;
  recipientName: string;
  phone?: string;
  addressLine: string;
  postalCode?: string;
  label?: string;
  latitude?: number;
  longitude?: number;
}

export interface CityResponse {
  id: number;
  name: string;
}

export interface DeliveryAreaResponse {
  id: number;
  cityId: number;
  name: string;
}

// ==========================================
// 7. RIDER & DELIVERY ASSIGNMENT TYPES
// ==========================================

export interface DeliveryAssignmentResponse {
  id: number;
  orderId: number;
  orderNumber?: string;
  restaurantId?: number;
  restaurantName?: string;
  riderId: number;
  riderName?: string;
  riderPhone?: string;
  transportType?: TransportType;
  status: DeliveryAssignmentStatus;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

export interface DeliveryAssignmentRequest {
  orderId: number;
  riderId: number;
}

export interface RiderProfileResponse {
  id: number;
  userId: number;
  userName?: string;
  userPhone?: string;
  transportType: TransportType;
  availability: boolean;
  status: string;
}

// ==========================================
// 8. NOTIFICATION & RATING TYPES
// ==========================================

export interface NotificationResponse {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadNotificationCount {
  count: number;
}

export interface RatingRequest {
  score: number;
  comment?: string;
}

export interface RatingResponse {
  id: number;
  orderId: number;
  restaurantId: number;
  score: number;
  comment?: string;
  createdAt?: string;
}

// ==========================================
// 9. COMMON PAGINATED RESPONSE
// ==========================================

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** RFC 7807 problem detail returned by the backend on errors. */
export interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
  instance?: string;
}
