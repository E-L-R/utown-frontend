import { useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  CheckCircle2,
  Clock,
  Compass,
  Package,
  Plus,
  Store,
  Truck,
} from 'lucide-react';
import { deliveryApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRiderProfile } from '../hooks/queries';
import { useTrackedAssignments } from '../hooks/trackedAssignments';
import { useToast } from '../components/Toast';
import { Badge, EmptyState, ErrorState, LoadingState, Spinner } from '../components/ui';
import {
  ASSIGNMENT_LABEL,
  ASSIGNMENT_TONE,
  formatDateTime,
} from '../lib/format';
import type { DeliveryAssignmentResponse } from '../types/api';

export default function RiderDashboardPage() {
  const { user } = useAuth();
  const { data: riderProfile, isPending: riderLoading, error: riderError } = useRiderProfile();
  const { ids: trackedIds, add: trackId } = useTrackedAssignments(riderProfile?.id);
  const { notify } = useToast();
  const qc = useQueryClient();

  const [manualIdInput, setManualIdInput] = useState('');

  // Fetch all assignments by tracked IDs
  const assignmentQueries = useQueries({
    queries: trackedIds.map((id) => ({
      queryKey: ['assignment', id],
      queryFn: () => deliveryApi.get(id),
      refetchInterval: 6_000,
    })),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => deliveryApi.accept(id),
    onSuccess: (data) => {
      qc.setQueryData(['assignment', data.id], data);
      notify('Delivery accepted! Head to the restaurant.', 'success');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to accept delivery'), 'error'),
  });

  const pickupMutation = useMutation({
    mutationFn: (id: number) => deliveryApi.pickup(id),
    onSuccess: (data) => {
      qc.setQueryData(['assignment', data.id], data);
      notify('Order picked up! Now en route to customer.', 'success');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to mark picked up'), 'error'),
  });

  const deliverMutation = useMutation({
    mutationFn: (id: number) => deliveryApi.deliver(id),
    onSuccess: (data) => {
      qc.setQueryData(['assignment', data.id], data);
      notify('Order successfully delivered! Great job!', 'success');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to mark delivered'), 'error'),
  });

  if (riderLoading) return <LoadingState label="Loading rider profile…" />;
  if (riderError) {
    return (
      <div className="container section">
        <ErrorState error={riderError} title="Could not load rider profile" />
      </div>
    );
  }

  const assignments = assignmentQueries
    .map((q) => q.data)
    .filter((a): a is DeliveryAssignmentResponse => Boolean(a))
    .sort((a, b) => b.id - a.id);

  const activeDeliveries = assignments.filter((a) => a.status !== 'DELIVERED' && a.status !== 'CANCELLED');
  const pastDeliveries = assignments.filter((a) => a.status === 'DELIVERED' || a.status === 'CANCELLED');

  const handleAddManualId = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(manualIdInput.trim());
    if (parsed && Number.isInteger(parsed)) {
      trackId(parsed);
      setManualIdInput('');
      notify(`Tracking assignment #${parsed}`, 'info');
    }
  };

  return (
    <div className="container section rider-dashboard">
      <div className="section-head row-between flex-wrap gap-md">
        <div>
          <div className="row items-center gap-xs text-accent text-sm font-semibold mb-xs">
            <Bike size={18} /> Rider Courier Portal
          </div>
          <h1>Deliveries Dashboard</h1>
          <p className="muted">
            Accept assignments, pick up from restaurants, and complete drop-offs.
          </p>
        </div>

        {riderProfile && (
          <div className="rider-status-card row items-center gap-md p-sm bg-surface rounded-xl border">
            <div className="role-icon role-icon--rider">
              <Bike size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm">
                {riderProfile.userName ?? user?.name}
              </div>
              <div className="row items-center gap-xs text-xs muted">
                <span>{riderProfile.transportType}</span>
                <span>•</span>
                <span className="text-success font-medium">
                  {riderProfile.availability ? 'Online & Available' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Assignment Tracker & Quick Action Bar */}
      <div className="panel bg-surface-subtle p-md mt-md">
        <form onSubmit={handleAddManualId} className="row items-center gap-sm flex-wrap">
          <span className="text-sm font-medium row items-center gap-xs">
            <Compass size={16} /> Track Assignment by ID:
          </span>
          <input
            type="number"
            placeholder="Assignment ID (e.g. 1)"
            value={manualIdInput}
            onChange={(e) => setManualIdInput(e.target.value)}
            className="input-sm rounded px-sm py-xs border"
            style={{ width: '220px' }}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={!manualIdInput.trim()}>
            <Plus size={14} /> Add
          </button>
          <span className="muted text-xs ml-auto">
            Tip: You can also dispatch orders to this rider from the <strong>Admin Dashboard</strong>.
          </span>
        </form>
      </div>

      {/* Active Assignments */}
      <div className="mt-lg">
        <h2 className="text-xl mb-md row items-center gap-xs">
          <Truck size={20} /> Active Assignments ({activeDeliveries.length})
        </h2>

        {activeDeliveries.length === 0 ? (
          <EmptyState
            icon={<Bike size={32} />}
            title="No active deliveries"
          >
            <p>You have no active orders to pick up or deliver right now. New dispatch jobs will appear here.</p>
          </EmptyState>
        ) : (
          <div className="grid grid--orders">
            {activeDeliveries.map((assignment) => {
              const isAssigned = assignment.status === 'ASSIGNED';
              const isAccepted = assignment.status === 'ACCEPTED';
              const isPickedUp = assignment.status === 'PICKED_UP';

              return (
                <div key={assignment.id} className="card order-manage-card">
                  <div className="order-manage-card__head row-between items-start">
                    <div>
                      <span className="mono font-semibold text-sm">
                        Assignment #{assignment.id}
                      </span>
                      <div className="muted text-xs row items-center gap-xs mt-xs">
                        <Clock size={12} />
                        <span>Order #{assignment.orderNumber ? assignment.orderNumber.slice(-8) : assignment.orderId}</span>
                      </div>
                    </div>

                    <Badge tone={ASSIGNMENT_TONE[assignment.status]} dot>
                      {ASSIGNMENT_LABEL[assignment.status]}
                    </Badge>
                  </div>

                  <div className="my-sm flex-col gap-xs text-sm">
                    <div className="row items-center gap-xs font-medium">
                      <Store size={15} className="text-accent" />
                      <span>{assignment.restaurantName || `Restaurant #${assignment.restaurantId}`}</span>
                    </div>

                    {assignment.assignedAt && (
                      <div className="text-xs muted row items-center gap-xs mt-xs">
                        <span>Assigned at {formatDateTime(assignment.assignedAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Rider Workflow Buttons */}
                  <div className="order-actions-row row gap-sm mt-md pt-sm border-t">
                    {isAssigned && (
                      <button
                        className="btn btn--primary btn--sm btn--block"
                        disabled={acceptMutation.isPending}
                        onClick={() => acceptMutation.mutate(assignment.id)}
                        id={`accept-assignment-${assignment.id}`}
                      >
                        {acceptMutation.isPending ? (
                          <Spinner size={14} />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Accept Assignment
                          </>
                        )}
                      </button>
                    )}

                    {isAccepted && (
                      <button
                        className="btn btn--primary btn--sm btn--block"
                        disabled={pickupMutation.isPending}
                        onClick={() => pickupMutation.mutate(assignment.id)}
                        id={`pickup-assignment-${assignment.id}`}
                      >
                        {pickupMutation.isPending ? (
                          <Spinner size={14} />
                        ) : (
                          <>
                            <Package size={14} /> Picked Up from Kitchen
                          </>
                        )}
                      </button>
                    )}

                    {isPickedUp && (
                      <button
                        className="btn btn--success btn--sm btn--block"
                        disabled={deliverMutation.isPending}
                        onClick={() => deliverMutation.mutate(assignment.id)}
                        id={`deliver-assignment-${assignment.id}`}
                      >
                        {deliverMutation.isPending ? (
                          <Spinner size={14} />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Mark Delivered to Customer
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Deliveries */}
      {pastDeliveries.length > 0 && (
        <div className="mt-xl">
          <h3 className="text-lg mb-md text-secondary">
            Completed Trips ({pastDeliveries.length})
          </h3>
          <div className="grid grid--orders">
            {pastDeliveries.map((assignment) => (
              <div key={assignment.id} className="card p-md opacity-80">
                <div className="row-between items-center">
                  <div>
                    <span className="mono text-xs font-semibold">
                      Assignment #{assignment.id}
                    </span>
                    <div className="font-semibold text-sm mt-xs">
                      {assignment.restaurantName || `Restaurant #${assignment.restaurantId}`}
                    </div>
                  </div>
                  <Badge tone={ASSIGNMENT_TONE[assignment.status]}>
                    {ASSIGNMENT_LABEL[assignment.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
