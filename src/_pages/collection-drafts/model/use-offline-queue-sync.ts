"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaptureActor } from "./capture-actor";
import { isBrowserOnline } from "./offline-capture";
import type { OfflineDraftRecord } from "./offline-records";
import { ensureOfflineDraftStore } from "./offline-port";
import { runAuthenticatedDrain } from "./run-authenticated-drain";
import type { DrainPendingResult } from "./offline-runner";

export function useOfflineQueueSync(actor: CaptureActor): {
  online: boolean;
  drain: () => Promise<DrainPendingResult>;
  refreshDrafts: () => Promise<readonly OfflineDraftRecord[]>;
} {
  const [online, setOnline] = useState(isBrowserOnline);

  const drain = useCallback(async (): Promise<DrainPendingResult> => {
    if (!isBrowserOnline()) {
      return { officialKept: false };
    }
    return runAuthenticatedDrain(actor);
  }, [actor]);

  const refreshDrafts = useCallback(async () => {
    const store = await ensureOfflineDraftStore();
    const rows = await store.listDrafts(actor.userId);
    await store.refreshSnapshot(actor.userId);
    return rows
      .filter((row) => row.syncStatus !== "synced")
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [actor.userId]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void drain();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [drain]);

  return { online, drain, refreshDrafts };
}
