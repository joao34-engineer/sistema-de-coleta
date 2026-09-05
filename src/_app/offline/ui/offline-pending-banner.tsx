"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaptureActor } from "@/_pages/collection-drafts/model/capture-actor";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { isBrowserOnline } from "@/_pages/collection-drafts/model/offline-capture";
import { messageForQueueError, offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { discardLocalDraft } from "@/_pages/collection-drafts/model/discard-local-draft";
import { ensureOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-port";
import { shouldEnqueueServerDiscard } from "@/_pages/collection-drafts/model/should-enqueue-server-discard";
import { useOfflineQueueSync } from "@/_pages/collection-drafts/model/use-offline-queue-sync";
import { Button } from "@/shared/ui/button";
import { OfflinePendingPanel } from "./offline-pending-panel";

type Props = Readonly<{
  actor: CaptureActor;
}>;

export function OfflinePendingBanner({ actor }: Props) {
  const [drafts, setDrafts] = useState<readonly OfflineDraftRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { drain, refreshDrafts } = useOfflineQueueSync(actor);

  const reloadPanel = useCallback(async () => {
    setDrafts(await refreshDrafts());
  }, [refreshDrafts]);

  const drainAndReload = useCallback(async () => {
    const drained = await drain();
    if (drained.officialKept) {
      setNotice(offlineCopy.discardOfficialKept);
    }
    await reloadPanel();
  }, [drain, reloadPanel]);

  useEffect(() => {
    void (async () => {
      await reloadPanel();
      if (!isBrowserOnline()) {
        return;
      }
      await drainAndReload();
    })();
  }, [drainAndReload, reloadPanel]);

  useEffect(() => {
    const onOnline = () => {
      void drainAndReload();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [drainAndReload]);

  if (collapsed && drafts.length > 0) {
    return (
      <div className="pointer-events-auto fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-md p-3">
        <Button type="button" variant="secondary" onClick={() => setCollapsed(false)}>
          {offlineCopy.showPending}
        </Button>
      </div>
    );
  }

  return (
    <OfflinePendingPanel
      drafts={drafts}
      busy={busy}
      notice={notice}
      bannerError={bannerError}
      retryResult={retryResult}
      onClose={() => setCollapsed(true)}
      onRetry={() => {
        if (busy) {
          return;
        }
        void (async () => {
          setBusy(true);
          setBannerError(null);
          setRetryResult(null);
          try {
            await drainAndReload();
            const nextDrafts = await refreshDrafts();
            setDrafts(nextDrafts);
            if (nextDrafts.length === 0) {
              setRetryResult(offlineCopy.syncComplete);
              return;
            }
            setRetryResult(messageForQueueError(nextDrafts[0]?.lastError));
          } catch {
            setBannerError(offlineCopy.failed);
          } finally {
            setBusy(false);
          }
        })();
      }}
      onDiscard={(draftId) => {
        void (async () => {
          const store = await ensureOfflineDraftStore();
          const target = drafts.find((row) => row.id === draftId) ?? (await store.getDraft(draftId, actor.userId));
          const mutations = target === null ? [] : await store.listMutations(draftId, actor.userId);
          const confirmServer = target !== null && shouldEnqueueServerDiscard(target, mutations);
          if (!window.confirm(confirmServer ? offlineCopy.discardConfirmSynced : offlineCopy.discardConfirm)) {
            return;
          }
          const result = await discardLocalDraft({ store, actor, collectionId: draftId });
          if (!result.ok) {
            setBannerError(messageForQueueError(result.error));
            await reloadPanel();
            return;
          }
          setBannerError(null);
          if (result.officialKept === true) {
            setNotice(offlineCopy.discardOfficialKept);
          }
          await reloadPanel();
        })();
      }}
    />
  );
}
