import type { CaptureActor } from "./capture-actor";
import { isBrowserOnline } from "./offline-capture";
import type { OfflineDraftStore } from "./offline-store";
import { runAuthenticatedDrain } from "./run-authenticated-drain";
import { shouldEnqueueServerDiscard } from "./should-enqueue-server-discard";

export type DiscardLocalDraftResult =
  | { ok: true; officialKept?: boolean }
  | { ok: false; error: string };

export async function discardLocalDraft(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  collectionId: string;
}): Promise<DiscardLocalDraftResult> {
  const draft = await input.store.getDraft(input.collectionId, input.actor.userId);
  if (draft === null) {
    return { ok: true };
  }
  const mutations = await input.store.listMutations(input.collectionId, input.actor.userId);
  if (!shouldEnqueueServerDiscard(draft, mutations)) {
    await input.store.deleteDraftTree(input.collectionId, input.actor.userId);
    await input.store.refreshSnapshot(input.actor.userId);
    return { ok: true };
  }
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "discard_draft",
    payload: draft.serverRowVersion === null ? {} : { expectedVersion: draft.serverRowVersion },
  });
  if (!isBrowserOnline()) {
    await input.store.refreshSnapshot(input.actor.userId);
    return { ok: true };
  }
  const drained = await runAuthenticatedDrain(input.actor);
  const leftover = await input.store.getDraft(input.collectionId, input.actor.userId);
  if (leftover !== null) {
    return { ok: false, error: leftover.lastError ?? "operation_failed" };
  }
  return drained.officialKept ? { ok: true, officialKept: true } : { ok: true };
}
