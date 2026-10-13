import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  Clock,
  Compass,
  Package,
  Plus,
  RefreshCw,
  Shield,
  Store,
} from 'lucide-react';
import { deliveryApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useOrders, useRestaurants } from '../hooks/queries';
import { trackAssignment } from '../hooks/trackedAssignments';
import { useToast } from '../components/Toast';
import { Badge, EmptyState, ErrorState, LoadingState, Modal, Spinner } from '../components/ui';
import {
  ASSIGNMENT_LABEL,
  ASSIGNMENT_TONE,
  ORDER_STATUS_LABEL,
  formatDateTime,
  formatMoney,
} from '../lib/format';
import type { DeliveryAssignmentRequest } from '../types/api';

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const { notify } = useToast();
  const { data: restaurants } = useRestaurants();
  const { data: orders, refetch: refetchOrders } = useOrders({}, { poll: 10_000 });

  const {
    data: assignments,
    isPending: assignmentsPending,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => deliveryApi.list(),
    refetchInterval: 10_000,
  });

  const { data: riders } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: () => deliveryApi.riders(),
  });

  // Dispatch Assignment Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | ''>('');
  const [selectedRiderId, setSelectedRiderId] = useState<number | ''>('');

  const dispatchMutation = useMutation({
    mutationFn: (body: DeliveryAssignmentRequest) => deliveryApi.create(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-assignments'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      // Record locally so rider view has this assignment immediately
      trackAssignment(created.riderId, created.id);
      notify(`Dispatched Assignment #${created.id} to rider!`, 'success');
      setDispatchModalOpen(false);
      setSelectedOrderId('');
      setSelectedRiderId('');
    },
    onError: (err) => notify(getErrorMessage(err, 'Failed to dispatch assignment'), 'error'),
  });

  if (assignmentsPending) return <LoadingState label="Loading admin dispatch console…" />;
  if (assignmentsError) {
    return (
      <div className="container section">
        <ErrorState error={assignmentsError} onRetry={refetchAssignments} />
      </div>
    );
  }

  const allOrders = orders ?? [];
  const allAssignments = assignments ?? [];

  return (
    <div className="container section admin-dashboard">
      <div className="section-head row-between flex-wrap gap-md">
        <div>
          <div className="row items-center gap-xs text-accent text-sm font-semibold mb-xs">
            <Shield size={18} /> Central Platform Oversight
          </div>
          <h1>Dispatch & Administration</h1>
          <p className="muted">
            Monitor restaurant orders, fleet riders, and dispatch deliveries.
          </p>
        </div>

        <div className="row items-center gap-sm">
          <button
            className="btn btn--primary"
            onClick={() => setDispatchModalOpen(true)}
            id="open-dispatch-modal"
          >
            <Plus size={16} /> Dispatch Rider
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              refetchOrders();
              refetchAssignments();
            }}
            title="Refresh"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid--cards mt-md">
        <div className="card p-md">
          <div className="row items-center gap-sm muted text-xs uppercase font-semibold">
            <Store size={16} className="text-accent" /> Active Restaurants
          </div>
          <div className="text-2xl font-bold mt-xs">{restaurants?.length ?? 0}</div>
        </div>

        <div className="card p-md">
          <div className="row items-center gap-sm muted text-xs uppercase font-semibold">
            <Clock size={16} className="text-accent" /> Total Platform Orders
          </div>
          <div className="text-2xl font-bold mt-xs">{allOrders.length}</div>
        </div>

        <div className="card p-md">
          <div className="row items-center gap-sm muted text-xs uppercase font-semibold">
            <Bike size={16} className="text-accent" /> Registered Riders
          </div>
          <div className="text-2xl font-bold mt-xs">{riders?.length ?? 0}</div>
        </div>

        <div className="card p-md">
          <div className="row items-center gap-sm muted text-xs uppercase font-semibold">
            <Package size={16} className="text-accent" /> Delivery Assignments
          </div>
          <div className="text-2xl font-bold mt-xs">{allAssignments.length}</div>
        </div>
      </div>

      {/* Delivery Assignments Table / Grid */}
      <div className="mt-xl">
        <div className="row-between items-center mb-md">
          <h2 className="text-xl">Delivery Assignments Fleet</h2>
        </div>

        {allAssignments.length === 0 ? (
          <EmptyState
            icon={<Compass size={32} />}
            title="No delivery assignments yet"
          >
            <p>Click "Dispatch Rider" above to assign an active restaurant order to a rider.</p>
          </EmptyState>
        ) : (
          <div className="panel overflow-hidden p-0">
            <div className="table-responsive">
              <table className="admin-table w-full text-left">
                <thead>
                  <tr className="border-b bg-surface-subtle text-xs muted font-semibold">
                    <th className="p-sm">Assignment ID</th>
                    <th className="p-sm">Order #</th>
                    <th className="p-sm">Restaurant</th>
                    <th className="p-sm">Rider Name</th>
                    <th className="p-sm">Transport</th>
                    <th className="p-sm">Status</th>
                    <th className="p-sm">Assigned At</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {allAssignments.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-surface-subtle">
                      <td className="p-sm font-semibold mono">#{a.id}</td>
                      <td className="p-sm mono">
                        {a.orderNumber ? a.orderNumber.slice(-8) : `Order #${a.orderId}`}
                      </td>
                      <td className="p-sm">{a.restaurantName || `Restaurant #${a.restaurantId}`}</td>
                      <td className="p-sm font-medium">{a.riderName || `Rider #${a.riderId}`}</td>
                      <td className="p-sm text-xs muted">{a.transportType || 'MOTORCYCLE'}</td>
                      <td className="p-sm">
                        <Badge tone={ASSIGNMENT_TONE[a.status]} dot>
                          {ASSIGNMENT_LABEL[a.status]}
                        </Badge>
                      </td>
                      <td className="p-sm text-xs muted">
                        {formatDateTime(a.assignedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      <Modal
        open={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Dispatch Delivery Assignment"
        footer={
          <div className="modal-cta">
            <button className="btn btn--ghost" onClick={() => setDispatchModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn--primary grow"
              disabled={
                dispatchMutation.isPending ||
                !selectedOrderId ||
                !selectedRiderId
              }
              onClick={() =>
                dispatchMutation.mutate({
                  orderId: Number(selectedOrderId),
                  riderId: Number(selectedRiderId),
                })
              }
              id="confirm-dispatch-button"
            >
              {dispatchMutation.isPending ? <Spinner size={16} /> : 'Dispatch Now'}
            </button>
          </div>
        }
      >
        <p className="muted mb-md">
          Assign an order to a rider so they can accept, collect from the kitchen, and complete delivery.
        </p>

        <div className="flex-col gap-md">
          <label className="field">
            <span>Select Order to Deliver</span>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(Number(e.target.value))}
              required
              id="dispatch-order-select"
            >
              <option value="">-- Choose an Order --</option>
              {allOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  Order #{o.orderNumber.slice(-8)} — {ORDER_STATUS_LABEL[o.status]} ({formatMoney(o.totalAmount)})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Select Rider</span>
            <select
              value={selectedRiderId}
              onChange={(e) => setSelectedRiderId(Number(e.target.value))}
              required
              id="dispatch-rider-select"
            >
              <option value="">-- Choose a Rider --</option>
              {riders && riders.length > 0 ? (
                riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.userName} ({r.transportType} - {r.availability ? 'Available' : 'Busy'})
                  </option>
                ))
              ) : (
                <option value="1">Speedy Rider (ID: 1 - MOTORCYCLE)</option>
              )}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}
