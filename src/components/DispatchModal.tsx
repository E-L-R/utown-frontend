import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bike } from 'lucide-react';
import { deliveryApi } from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import { useInvalidateOrders, useRiders } from '../hooks/queries';
import { TRANSPORT_LABEL, cx, initials, shortOrderNo } from '../lib/format';
import { useToast } from './Toast';
import { EmptyState, Modal, Spinner } from './ui';
import type { OrderResponse } from '../types/api';

/** Pick an available rider for an order. Riders become unavailable once they hold an active job. */
export function DispatchModal({ order, onClose }: { order: OrderResponse | null; onClose: () => void }) {
  const { data: riders, isPending } = useRiders(Boolean(order));
  const invalidate = useInvalidateOrders();
  const { notify } = useToast();
  const [riderId, setRiderId] = useState<number | null>(null);

  const available = (riders ?? []).filter((r) => r.availability && r.status === 'ACTIVE');
  const busy = (riders ?? []).filter((r) => !(r.availability && r.status === 'ACTIVE'));

  useEffect(() => {
    if (order) setRiderId(null);
  }, [order]);
  useEffect(() => {
    if (riderId == null && available.length) setRiderId(available[0].id);
  }, [available, riderId]);

  const dispatch = useMutation({
    mutationFn: () => deliveryApi.create({ orderId: order!.id, riderId: riderId! }),
    onSuccess: (a) => {
      invalidate();
      notify(`${a.riderName ?? 'Rider'} is on the job`, 'success');
      onClose();
    },
    onError: (e) => notify(getErrorMessage(e, 'Could not assign rider'), 'error'),
  });

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={order ? `Send a rider for #${shortOrderNo(order.orderNumber)}` : 'Send a rider'}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary grow" disabled={!riderId || dispatch.isPending} onClick={() => dispatch.mutate()} id="confirm-dispatch-button">
            {dispatch.isPending ? <Spinner /> : <><Bike size={16} /> Assign rider</>}
          </button>
        </>
      }
    >
      {isPending ? (
        <div className="state"><Spinner /></div>
      ) : available.length === 0 ? (
        <EmptyState icon={<Bike size={26} />} title="Every rider is busy">
          <p>Riders free up as soon as they finish a delivery, or when they go online from the rider app.</p>
        </EmptyState>
      ) : (
        <div className="choice-list" role="radiogroup" aria-label="Available riders">
          {available.map((r) => (
            <label key={r.id} className={cx('choice', riderId === r.id && 'is-checked')}>
              <input type="radio" name="rider" checked={riderId === r.id} onChange={() => setRiderId(r.id)} />
              <span className="avatar avatar--lg role--rider">{initials(r.userName)}</span>
              <span className="grow">
                <strong>{r.userName ?? `Rider #${r.id}`}</strong>
                <span className="small muted" style={{ display: 'block' }}>{TRANSPORT_LABEL[r.transportType]} · online</span>
              </span>
              <span className="presence is-on" />
            </label>
          ))}
        </div>
      )}
      {busy.length > 0 && (
        <p className="small muted" style={{ marginTop: 14 }}>
          Unavailable: {busy.map((r) => r.userName ?? `#${r.id}`).join(', ')}
        </p>
      )}
    </Modal>
  );
}
