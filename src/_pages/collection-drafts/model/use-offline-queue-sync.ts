"use client";

import { useCallback } from "react";
import type { CaptureActor } from "./capture-actor";
import { isBrowserOnline } from "./offline-capture";
import type { OfflineDraftRecord } from "./offline-records";
import { ensureOfflineDraftStore } from "./offline-port";
import { runAuthenticatedDrain } from "./run-authenticated-drain";
import type { DrainPendingResult } from "./offline-runner";
import { useOnlineStatus } from "@/shared/lib/pwa/use-online-status";

export function useOfflineQueueSync(actor: CaptureActor): {
  online: boolean;
  drain: () => Promise<DrainPendingResult>;
  refreshDrafts: () => Promise<readonly OfflineDraftRecord[]>;
} {
  const online = useOnlineStatus();

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

  return { online, drain, refreshDrafts };
}
