import { useCallback, useEffect, useState } from 'react';

/**
 * The live backend only lets ADMIN list delivery assignments; riders can read/act on an
 * assignment only by ID. We therefore keep a per-rider list of known assignment IDs in
 * localStorage. Admin dispatch writes to it, so in the demo switcher flow the rider sees
 * new jobs instantly. Riders can also add an ID manually.
 */
const keyFor = (riderId: number) => `utown.assignments.rider.${riderId}`;
const EVENT = 'utown:assignments';

export function readTracked(riderId: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(riderId)) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export function trackAssignment(riderId: number, assignmentId: number) {
  const ids = readTracked(riderId);
  if (!ids.includes(assignmentId)) {
    localStorage.setItem(keyFor(riderId), JSON.stringify([assignmentId, ...ids]));
    window.dispatchEvent(new Event(EVENT));
  }
}

export function useTrackedAssignments(riderId?: number) {
  const [ids, setIds] = useState<number[]>(() => (riderId ? readTracked(riderId) : []));

  useEffect(() => {
    if (!riderId) return;
    const sync = () => setIds(readTracked(riderId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [riderId]);

  const add = useCallback((id: number) => riderId && trackAssignment(riderId, id), [riderId]);
  const remove = useCallback(
    (id: number) => {
      if (!riderId) return;
      localStorage.setItem(keyFor(riderId), JSON.stringify(readTracked(riderId).filter((x) => x !== id)));
      window.dispatchEvent(new Event(EVENT));
    },
    [riderId],
  );

  return { ids, add, remove };
}
