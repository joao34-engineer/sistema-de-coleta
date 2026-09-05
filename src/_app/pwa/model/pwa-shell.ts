export const DEV_SW_CLEARED_SESSION_KEY = "mjt-pwa-dev-sw-cleared" as const;

export type PwaShellProps = {
  /**
   * After SKIP_WAITING, reload on `controllerchange` only when this returns true.
   * Defaults to true. Callers must not inspect IndexedDB here — pass a snapshot.
   */
  readonly canReload?: () => boolean;
  readonly hasPendingWork?: boolean;
};

export function shouldReloadOnControllerChange(canReload: (() => boolean) | undefined): boolean {
  if (canReload === undefined) {
    return true;
  }

  return canReload();
}

export function shouldReloadAfterDevServiceWorkerCleanup(
  controller: ServiceWorker | null,
  alreadyCleared: boolean,
): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (alreadyCleared) {
    return false;
  }

  return controller !== null;
}
