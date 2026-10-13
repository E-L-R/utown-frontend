import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Clock,
  MapPin,
  Receipt,
  Star,
  Store,
  Wallet,
} from 'lucide-react';
import { orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { qk, useInvalidateOrders, useOrder, useRestaurants } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { OrderStepper } from '../components/OrderStepper';
import { Badge, ErrorState, LoadingState, Modal, SmartImage, Spinner } from '../components/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_LABEL,
  formatDateTime,
  formatMoney,
} from '../lib/format';
import type { RatingRequest } from '../types/api';

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { data: order, isPending, error, refetch } = useOrder(orderId);
  const { data: restaurants } = useRestaurants();
  const { user } = useAuth();
  const { notify } = useToast();
  const invalidateOrders = useInvalidateOrders();
  const qc = useQueryClient();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of plans');
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const cancelMutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId, cancelReason.trim() || 'Cancelled by customer'),
    onSuccess: (updated) => {
      invalidateOrders(updated);
      notify('Order has been cancelled', 'info');
      setCancelModalOpen(false);
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to cancel order'), 'error'),
  });

  const rateMutation = useMutation({
    mutationFn: (body: RatingRequest) => orderApi.rate(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.order(orderId) });
      notify('Thank you for rating!', 'success');
      setRatingModalOpen(false);
    },
    onError: (err) => notify(getErrorMessage(err, 'Could not submit rating'), 'error'),
  });

  if (isPending) return <LoadingState label="Fetching live order details…" />;
  if (error || !order) {
    return (
      <div className="container section">
        <ErrorState error={error ?? new Error('Order not found')} onRetry={refetch} />
      </div>
    );
  }

  const restaurant = restaurants?.find((r) => r.id === order.restaurantId);
  const isCustomer = user?.role === 'CUSTOMER';
  const canCancel = order.status === 'PENDING' && isCustomer;
  const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';

  return (
    <div className="container section order-tracking">
      <div className="order-tracking__head">
        <Link to="/orders" className="back-link">
          <ArrowLeft size={16} /> Back to orders
        </Link>
        <div className="row-between flex-wrap gap-md mt-sm">
          <div>
            <div className="row gap-sm items-center">
              <span className="mono muted text-sm">Order #{order.orderNumber.slice(-8)}</span>
              <Badge tone={ORDER_STATUS_TONE[order.status]} dot>
                {ORDER_STATUS_LABEL[order.status]}
              </Badge>
            </div>
            <h1 className="mt-xs">
              {restaurant ? restaurant.name : `Restaurant #${order.restaurantId}`}
            </h1>
          </div>

          <div className="row gap-sm items-center">
            {canCancel && (
              <button
                className="btn btn--danger"
                onClick={() => setCancelModalOpen(true)}
                id="cancel-order-button"
              >
                <Ban size={16} /> Cancel order
              </button>
            )}
            {isDelivered && (
              <button
                className="btn btn--primary"
                onClick={() => setRatingModalOpen(true)}
                id="rate-order-button"
              >
                <Star size={16} /> Rate order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stepper block */}
      <div className="panel order-stepper-panel mt-md">
        <div className="panel__head row-between">
          <span className="row items-center gap-xs font-semibold">
            <Clock size={18} /> Live delivery status
          </span>
          {order.estimatedCookingMinutes && order.status === 'ACCEPTED' && (
            <span className="chip chip--accent">
              ~{order.estimatedCookingMinutes} min prep time
            </span>
          )}
        </div>
        <OrderStepper order={order} />
      </div>

      <div className="order-grid mt-lg">
        {/* Order items */}
        <div className="panel">
          <div className="panel__head">
            <h2 className="text-lg">Items in this order</h2>
          </div>
          <ul className="order-items-list">
            {order.items.map((item) => (
              <li key={item.id} className="order-item-row">
                <div className="order-item-row__main">
                  <strong>
                    {item.quantity}× {item.dishName}
                  </strong>
                  {item.options && item.options.length > 0 && (
                    <div className="muted small">
                      {item.options
                        .map(
                          (o) =>
                            `${o.optionName}${
                              o.optionPrice ? ` (+${formatMoney(o.optionPrice)})` : ''
                            }`
                        )
                        .join(', ')}
                    </div>
                  )}
                </div>
                <div className="order-item-row__price font-medium">
                  {formatMoney(item.subTotal ?? item.unitPrice * item.quantity)}
                </div>
              </li>
            ))}
          </ul>

          <div className="order-receipt-summary mt-md">
            <div className="summary-row">
              <span className="muted">Subtotal</span>
              <span>{formatMoney(order.subTotal)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">Delivery fee</span>
              <span>{formatMoney(order.deliveryFee)}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span>Total amount</span>
              <strong className="text-accent">{formatMoney(order.totalAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Order meta */}
        <div className="order-sidebar flex-col gap-md">
          <div className="panel">
            <div className="panel__head">
              <h2 className="text-lg">Delivery & Payment</h2>
            </div>
            <div className="order-meta-info flex-col gap-sm">
              <div className="row items-start gap-sm">
                <MapPin size={18} className="text-accent shrink-0 mt-xs" />
                <div>
                  <div className="muted small font-medium">Delivery destination</div>
                  <div className="font-semibold">Address #{order.addressId}</div>
                  {order.deliveryNote && (
                    <p className="mt-xs text-sm text-secondary bg-surface-subtle p-xs rounded">
                      Note: "{order.deliveryNote}"
                    </p>
                  )}
                </div>
              </div>

              <div className="row items-start gap-sm pt-sm border-t">
                <Wallet size={18} className="text-accent shrink-0 mt-xs" />
                <div>
                  <div className="muted small font-medium">Payment method</div>
                  <div className="font-semibold">{PAYMENT_LABEL[order.paymentMethod]}</div>
                  <Badge tone={order.paymentStatus === 'PAID' ? 'success' : 'warn'} dot>
                    Payment: {order.paymentStatus}
                  </Badge>
                </div>
              </div>

              <div className="row items-start gap-sm pt-sm border-t">
                <Receipt size={18} className="text-accent shrink-0 mt-xs" />
                <div>
                  <div className="muted small font-medium">Placed on</div>
                  <div className="text-sm font-medium">
                    {order.acceptedAt
                      ? formatDateTime(order.acceptedAt)
                      : 'Recently placed'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {restaurant && (
            <div className="panel restaurant-mini-panel">
              <div className="row gap-md items-center">
                <SmartImage
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="rounded-lg w-12 h-12 object-cover"
                />
                <div className="grow">
                  <h4 className="font-semibold">{restaurant.name}</h4>
                  <div className="muted small">{restaurant.address}</div>
                </div>
                <Link to={`/restaurant/${restaurant.id}`} className="btn btn--ghost btn--sm">
                  <Store size={14} /> Menu
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel this order?"
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setCancelModalOpen(false)}>
              Keep Order
            </button>
            <button
              className="btn btn--danger grow"
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? <Spinner size={16} /> : 'Confirm Cancellation'}
            </button>
          </div>
        }
      >
        <p className="muted mb-md">
          Orders can only be cancelled while still in <strong>Pending</strong> status before the restaurant starts cooking.
        </p>
        <label className="field">
          <span>Reason for cancellation</span>
          <textarea
            className="textarea"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Changed my mind, duplicate order"
            required
          />
        </label>
      </Modal>

      {/* Rating Modal */}
      <Modal
        open={ratingModalOpen}
        onClose={() => setRatingModalOpen(false)}
        title="Rate your meal"
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setRatingModalOpen(false)}>
              Close
            </button>
            <button
              className="btn btn--primary grow"
              disabled={rateMutation.isPending}
              onClick={() => rateMutation.mutate({ score: ratingScore, comment: ratingComment.trim() || undefined })}
            >
              {rateMutation.isPending ? <Spinner size={16} /> : 'Submit Rating'}
            </button>
          </div>
        }
      >
        <div className="rating-select-box flex-col items-center gap-md py-sm">
          <div className="stars-row row gap-xs">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                className={`star-btn ${ratingScore >= val ? 'is-active' : ''}`}
                onClick={() => setRatingScore(val)}
                aria-label={`${val} Stars`}
              >
                <Star size={32} fill={ratingScore >= val ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <span className="font-semibold text-lg">
            {ratingScore === 5 ? 'Excellent! ⭐️⭐️⭐️⭐️⭐️' : `${ratingScore} out of 5 stars`}
          </span>
        </div>

        <label className="field mt-md">
          <span>Feedback or comments (optional)</span>
          <textarea
            className="textarea"
            rows={3}
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="How was the food? Was it hot and on time?"
          />
        </label>
      </Modal>
    </div>
  );
}
