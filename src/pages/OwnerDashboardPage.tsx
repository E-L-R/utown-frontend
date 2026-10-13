import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChefHat,
  Check,
  Clock,
  Flame,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { orderApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useOrders, useRestaurants } from '../hooks/queries';
import { useToast } from '../components/Toast';
import { Badge, EmptyState, ErrorState, LoadingState, Modal, Spinner } from '../components/ui';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  formatDateTime,
  formatMoney,
} from '../lib/format';
import type { OrderResponse } from '../types/api';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const { data: restaurants } = useRestaurants();
  const qc = useQueryClient();
  const { notify } = useToast();

  // Find restaurants owned by current user
  const myRestaurants = restaurants?.filter(
    (r) => r.ownerId === user?.id || user?.role === 'ADMIN'
  ) ?? [];
  const [selectedRestId, setSelectedRestId] = useState<number | undefined>(() => myRestaurants[0]?.id);

  // If selectedRestId not set yet, pick first available
  const activeRestId = selectedRestId ?? myRestaurants[0]?.id ?? 1;

  const { data: orders, isPending, error, refetch } = useOrders(
    { restaurantId: activeRestId },
    { poll: 8_000 }
  );

  const [activeTab, setActiveTab] = useState<'PENDING' | 'KITCHEN' | 'READY' | 'ALL'>('PENDING');

  // Accept Order State
  const [acceptingOrder, setAcceptingOrder] = useState<OrderResponse | null>(null);
  const [cookingMinutes, setCookingMinutes] = useState(20);

  // Decline Order State
  const [decliningOrder, setDecliningOrder] = useState<OrderResponse | null>(null);
  const [declineReason, setDeclineReason] = useState('Kitchen currently at capacity');

  const invalidateOrders = () => {
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const acceptMutation = useMutation({
    mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
      orderApi.accept(id, minutes),
    onSuccess: () => {
      invalidateOrders();
      notify('Order accepted! Sent to kitchen queue.', 'success');
      setAcceptingOrder(null);
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to accept order'), 'error'),
  });

  const prepareMutation = useMutation({
    mutationFn: (id: number) => orderApi.prepare(id),
    onSuccess: () => {
      invalidateOrders();
      notify('Order is now in preparation (cooking).', 'info');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to update order to preparation'), 'error'),
  });

  const readyMutation = useMutation({
    mutationFn: (id: number) => orderApi.ready(id),
    onSuccess: () => {
      invalidateOrders();
      notify('Order marked ready for rider pickup!', 'success');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to mark order ready'), 'error'),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      orderApi.decline(id, reason),
    onSuccess: () => {
      invalidateOrders();
      notify('Order was declined.', 'info');
      setDecliningOrder(null);
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to decline order'), 'error'),
  });

  if (isPending) return <LoadingState label="Loading kitchen orders…" />;
  if (error) {
    return (
      <div className="container section">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const allOrders = orders ?? [];
  const currentRest = restaurants?.find((r) => r.id === activeRestId);

  const pendingOrders = allOrders.filter((o) => o.status === 'PENDING');
  const kitchenOrders = allOrders.filter(
    (o) => o.status === 'ACCEPTED' || o.status === 'IN_PREPARATION'
  );
  const readyOrders = allOrders.filter((o) => o.status === 'READY_FOR_PICKUP');

  const filteredOrders = allOrders.filter((o) => {
    if (activeTab === 'PENDING') return o.status === 'PENDING';
    if (activeTab === 'KITCHEN')
      return o.status === 'ACCEPTED' || o.status === 'IN_PREPARATION';
    if (activeTab === 'READY') return o.status === 'READY_FOR_PICKUP';
    return true;
  });

  return (
    <div className="container section owner-dashboard">
      <div className="section-head row-between flex-wrap gap-md">
        <div>
          <div className="row items-center gap-xs text-accent text-sm font-semibold mb-xs">
            <ChefHat size={18} /> Kitchen Operations Dashboard
          </div>
          <h1>{currentRest ? currentRest.name : 'Kitchen Orders'}</h1>
          <p className="muted">
            Manage incoming food orders in real-time (`ACCEPT` ➔ `PREPARE` ➔ `READY`)
          </p>
        </div>

        <div className="row items-center gap-sm flex-wrap">
          {myRestaurants.length > 1 && (
            <select
              value={activeRestId}
              onChange={(e) => setSelectedRestId(Number(e.target.value))}
              className="select-dropdown"
            >
              {myRestaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          <button className="btn btn--ghost btn--sm" onClick={() => refetch()} title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar mt-md">
        <div className="chips">
          <button
            className={`chip-btn ${activeTab === 'PENDING' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('PENDING')}
          >
            Pending New ({pendingOrders.length})
          </button>
          <button
            className={`chip-btn ${activeTab === 'KITCHEN' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('KITCHEN')}
          >
            Cooking / Active ({kitchenOrders.length})
          </button>
          <button
            className={`chip-btn ${activeTab === 'READY' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('READY')}
          >
            Ready for Pickup ({readyOrders.length})
          </button>
          <button
            className={`chip-btn ${activeTab === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            All Orders ({allOrders.length})
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ChefHat size={32} />}
          title={`No ${activeTab.toLowerCase()} orders`}
        >
          <p>The kitchen is running smoothly! New orders will arrive here automatically.</p>
        </EmptyState>
      ) : (
        <div className="grid grid--orders mt-md">
          {filteredOrders.map((order) => {
            const isPendingStatus = order.status === 'PENDING';
            const isAccepted = order.status === 'ACCEPTED';
            const isInPrep = order.status === 'IN_PREPARATION';
            const isReady = order.status === 'READY_FOR_PICKUP';

            return (
              <div key={order.id} className="card order-manage-card">
                <div className="order-manage-card__head row-between items-start gap-sm">
                  <div>
                    <span className="mono font-semibold text-sm">
                      #{order.orderNumber.slice(-8)}
                    </span>
                    <div className="muted text-xs row items-center gap-xs mt-xs">
                      <Clock size={12} />
                      {order.acceptedAt
                        ? formatDateTime(order.acceptedAt)
                        : 'Placed just now'}
                    </div>
                  </div>

                  <Badge tone={ORDER_STATUS_TONE[order.status]} dot>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>

                <div className="order-manage-card__items my-sm">
                  <ul className="dish-order-list">
                    {order.items.map((item) => (
                      <li key={item.id} className="dish-order-row">
                        <span className="font-bold text-accent">{item.quantity}×</span>
                        <div className="grow">
                          <span className="font-semibold text-sm">{item.dishName}</span>
                          {item.options && item.options.length > 0 && (
                            <div className="text-xs muted">
                              {item.options.map((o) => o.optionName).join(', ')}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {formatMoney(item.subTotal ?? item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.deliveryNote && (
                  <div className="delivery-note-box text-xs bg-surface-subtle p-xs rounded my-xs text-secondary">
                    <strong>Note:</strong> {order.deliveryNote}
                  </div>
                )}

                <div className="row-between text-sm py-xs border-t mt-xs">
                  <span className="muted">Total ({order.paymentMethod})</span>
                  <strong className="text-accent">{formatMoney(order.totalAmount)}</strong>
                </div>

                {/* State Machine Action Buttons */}
                <div className="order-actions-row row gap-sm mt-md pt-sm border-t">
                  {isPendingStatus && (
                    <>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setDecliningOrder(order)}
                        id={`decline-order-${order.id}`}
                      >
                        <Ban size={14} /> Decline
                      </button>
                      <button
                        className="btn btn--primary btn--sm grow"
                        onClick={() => {
                          setAcceptingOrder(order);
                          setCookingMinutes(order.estimatedCookingMinutes || 20);
                        }}
                        id={`accept-order-${order.id}`}
                      >
                        <Check size={14} /> Accept Order
                      </button>
                    </>
                  )}

                  {isAccepted && (
                    <button
                      className="btn btn--primary btn--sm btn--block"
                      disabled={prepareMutation.isPending}
                      onClick={() => prepareMutation.mutate(order.id)}
                      id={`prepare-order-${order.id}`}
                    >
                      {prepareMutation.isPending ? (
                        <Spinner size={14} />
                      ) : (
                        <>
                          <Flame size={14} /> Start Preparation
                        </>
                      )}
                    </button>
                  )}

                  {isInPrep && (
                    <button
                      className="btn btn--primary btn--sm btn--block"
                      disabled={readyMutation.isPending}
                      onClick={() => readyMutation.mutate(order.id)}
                      id={`ready-order-${order.id}`}
                    >
                      {readyMutation.isPending ? (
                        <Spinner size={14} />
                      ) : (
                        <>
                          <PackageCheck size={14} /> Mark Ready for Pickup
                        </>
                      )}
                    </button>
                  )}

                  {isReady && (
                    <div className="muted text-xs row items-center justify-center gap-xs w-full py-xs">
                      <Clock size={14} /> Waiting for rider pickup
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Order Modal */}
      <Modal
        open={Boolean(acceptingOrder)}
        onClose={() => setAcceptingOrder(null)}
        title={`Accept Order #${acceptingOrder?.orderNumber.slice(-8)}`}
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setAcceptingOrder(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary grow"
              disabled={acceptMutation.isPending}
              onClick={() =>
                acceptingOrder &&
                acceptMutation.mutate({
                  id: acceptingOrder.id,
                  minutes: cookingMinutes,
                })
              }
            >
              {acceptMutation.isPending ? (
                <Spinner size={16} />
              ) : (
                `Confirm & Set ${cookingMinutes} min`
              )}
            </button>
          </div>
        }
      >
        <p className="muted mb-md">
          How many minutes will the kitchen need to prepare this meal?
        </p>

        <div className="minutes-preset-row row gap-sm mb-md">
          {[15, 20, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              className={`chip-btn ${cookingMinutes === m ? 'is-active' : ''}`}
              onClick={() => setCookingMinutes(m)}
            >
              {m} mins
            </button>
          ))}
        </div>

        <label className="field">
          <span>Estimated Cooking Time (Minutes)</span>
          <input
            type="number"
            min={5}
            max={120}
            value={cookingMinutes}
            onChange={(e) => setCookingMinutes(Math.max(5, Number(e.target.value)))}
            required
          />
        </label>
      </Modal>

      {/* Decline Order Modal */}
      <Modal
        open={Boolean(decliningOrder)}
        onClose={() => setDecliningOrder(null)}
        title="Decline this order?"
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setDecliningOrder(null)}>
              Keep Order
            </button>
            <button
              className="btn btn--danger grow"
              disabled={declineMutation.isPending || !declineReason.trim()}
              onClick={() =>
                decliningOrder &&
                declineMutation.mutate({
                  id: decliningOrder.id,
                  reason: declineReason.trim(),
                })
              }
            >
              {declineMutation.isPending ? <Spinner size={16} /> : 'Decline Order'}
            </button>
          </div>
        }
      >
        <p className="muted mb-md">
          Please provide a reason so the customer understands why their order could not be fulfilled.
        </p>
        <label className="field">
          <span>Reason for declining</span>
          <textarea
            className="textarea"
            rows={3}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            required
          />
        </label>
      </Modal>
    </div>
  );
}
