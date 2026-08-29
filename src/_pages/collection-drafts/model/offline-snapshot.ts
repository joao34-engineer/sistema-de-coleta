export type OfflineSnapshot = Readonly<{
  pendingCount: number;
  failedCount: number;
  draining: boolean;
}>;

const emptySnapshot: OfflineSnapshot = {
  pendingCount: 0,
  failedCount: 0,
  draining: false,
};

let snapshot: OfflineSnapshot = emptySnapshot;
const listeners = new Set<() => void>();

export function getOfflineSnapshot(): OfflineSnapshot {
  return snapshot;
}

export function canReloadFromSnapshot(current: OfflineSnapshot = snapshot): boolean {
  return current.pendingCount === 0 && !current.draining;
}

export function subscribeOfflineSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setOfflineSnapshot(next: OfflineSnapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

export function resetOfflineSnapshotForTests(): void {
  snapshot = emptySnapshot;
  listeners.clear();
}
