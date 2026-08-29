"use client";

import { useEffect, useState } from "react";
import { PwaShell } from "./pwa-shell";
import { canReloadFromSnapshot, getOfflineSnapshot, subscribeOfflineSnapshot } from "@/_pages/collection-drafts/model/offline-snapshot";

export function AppPwaShell() {
  const [snapshot, setSnapshot] = useState(getOfflineSnapshot);

  useEffect(() => {
    return subscribeOfflineSnapshot(() => {
      setSnapshot(getOfflineSnapshot());
    });
  }, []);

  return (
    <PwaShell
      canReload={() => canReloadFromSnapshot()}
      hasPendingWork={snapshot.pendingCount > 0 || snapshot.draining}
    />
  );
}
