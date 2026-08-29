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
