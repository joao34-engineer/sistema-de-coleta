"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaptureActor } from "@/_pages/collection-drafts/model/capture-actor";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { isBrowserOnline } from "@/_pages/collection-drafts/model/offline-capture";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { ensureOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-port";
import { browserDrainLock, drainAllPending } from "@/_pages/collection-drafts/model/offline-runner";
import { productionOfflineCommands } from "@/_pages/collection-drafts/model/production-offline-commands";
import { OfflinePendingPanel } from "./offline-pending-panel";

type Props = Readonly<{
  actor: CaptureActor;
}>;

export function OfflinePendingBanner({ actor }: Props) {
  const [drafts, setDrafts] = useState<readonly OfflineDraftRecord[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const store = await ensureOfflineDraftStore();
    const rows = await store.listDrafts(actor.userId);
    setDrafts(rows.filter((row) => row.syncStatus !== "synced"));
    await store.refreshSnapshot(actor.userId);
  }, [actor.userId]);

  useEffect(() => {
    void (async () => {
      await refresh();
      if (!isBrowserOnline()) {
        return;
      }
      const store = await ensureOfflineDraftStore();
      await drainAllPending({
        store,
        commands: productionOfflineCommands,
        actor,
        lock: browserDrainLock(),
      });
      await refresh();
    })();
  }, [actor, refresh]);

  return (
    <OfflinePendingPanel
      drafts={drafts}
      busy={busy}
      onRetry={() => {
        void (async () => {
          setBusy(true);
          const store = await ensureOfflineDraftStore();
          await drainAllPending({
            store,
            commands: productionOfflineCommands,
            actor,
            lock: browserDrainLock(),
          });
          await refresh();
          setBusy(false);
        })();
      }}
      onDiscard={(draftId) => {
        if (!window.confirm(offlineCopy.discardConfirm)) {
          return;
        }
        void (async () => {
          const store = await ensureOfflineDraftStore();
          await store.deleteDraftTree(draftId, actor.userId);
          await refresh();
        })();
      }}
    />
  );
}
