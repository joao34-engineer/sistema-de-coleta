"use client";

import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
