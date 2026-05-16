export interface ReadinessSnapshot {
  readonly rdkitLoading: boolean;
  readonly inflightRequests: number;
}

export type ReadinessListener = (snap: ReadinessSnapshot) => void;

let snapshot: ReadinessSnapshot = { rdkitLoading: false, inflightRequests: 0 };
const listeners = new Set<ReadinessListener>();

function notify(): void {
  const snap = snapshot;
  for (const l of listeners) l(snap);
}

export function subscribeReadiness(listener: ReadinessListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getReadinessSnapshot(): ReadinessSnapshot {
  return snapshot;
}

export function setRdkitLoading(loading: boolean): void {
  if (snapshot.rdkitLoading === loading) return;
  snapshot = { ...snapshot, rdkitLoading: loading };
  notify();
}

export function incrementInflight(): void {
  snapshot = { ...snapshot, inflightRequests: snapshot.inflightRequests + 1 };
  notify();
}

export function decrementInflight(): void {
  snapshot = { ...snapshot, inflightRequests: Math.max(0, snapshot.inflightRequests - 1) };
  notify();
}

/** Reset for testing. */
export function resetReadiness(): void {
  snapshot = { rdkitLoading: false, inflightRequests: 0 };
  listeners.clear();
}
