type NavPendingListener = (prefix: string | null) => void;

/** Survives layout client remounts during soft navigation. */
let stickyPendingPrefix: string | null = null;
const listeners = new Set<NavPendingListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(stickyPendingPrefix);
  }
}

export function getStickyPendingPrefix(): string | null {
  return stickyPendingPrefix;
}

export function setStickyPendingPrefix(prefix: string | null): void {
  stickyPendingPrefix = prefix;
  notifyListeners();
}

export function subscribeNavPending(listener: NavPendingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: wipe sticky tab selection between cases. */
export function resetNavPendingForTests(): void {
  stickyPendingPrefix = null;
  notifyListeners();
}
