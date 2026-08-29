import type { OfflineDraftStore } from "./offline-store";
import type { OfflineSyncCommands } from "./offline-commands";
import type { CaptureActor } from "./capture-actor";
import {
  createCustomerPayloadSchema,
  createDraftPayloadSchema,
  finalizePayloadSchema,
  itemPayloadSchema,
  patchDraftPayloadSchema,
  saveSignaturePayloadSchema,
  type OfflineDraftRecord,
  type OfflineMutationRecord,
} from "./offline-records";

const STALE_RETRY_ONCE = "stale_version";
const AUTH_ERROR = "authentication_required";

export type DrainLock = {
  request(name: string, callback: () => Promise<void>): Promise<void>;
};

const moduleLockState = { busy: false };

export const fallbackDrainLock: DrainLock = {
  async request(_name, callback) {
    if (moduleLockState.busy) {
      return;
    }
    moduleLockState.busy = true;
    try {
      await callback();
    } finally {
      moduleLockState.busy = false;
    }
  },
};

export function browserDrainLock(): DrainLock {
  if (typeof navigator === "undefined" || !("locks" in navigator) || navigator.locks === undefined) {
    return fallbackDrainLock;
  }
  return {
    async request(name, callback) {
      await navigator.locks.request(name, () => callback());
    },
  };
}

function isSuccess<T extends { ok: boolean }>(result: T): result is T & { ok: true } {
  return result.ok;
}

async function markFailed(
  store: OfflineDraftStore,
  mutation: OfflineMutationRecord,
  draft: OfflineDraftRecord,
  error: string,
): Promise<void> {
  await store.putMutation({
    ...mutation,
    status: "failed",
    attempts: mutation.attempts + 1,
    lastError: error,
  });
  await store.putDraft({
    ...draft,
    syncStatus: "failed",
    lastError: error,
    updatedAt: store.nowIso(),
  });
}

async function markDone(store: OfflineDraftStore, mutation: OfflineMutationRecord): Promise<void> {
  await store.putMutation({
    ...mutation,
    status: "done",
    attempts: mutation.attempts + 1,
    lastError: null,
  });
}

async function refreshVersion(
  store: OfflineDraftStore,
  commands: OfflineSyncCommands,
  draft: OfflineDraftRecord,
): Promise<OfflineDraftRecord> {
  const fetched = await commands.fetchDraft(draft.id);
  if (!isSuccess(fetched)) {
    return draft;
  }
  const next: OfflineDraftRecord = {
    ...draft,
    serverRowVersion: fetched.draft.rowVersion,
    hasServerSignature: fetched.hasSignature,
    serverCustomerId: fetched.draft.customerId ?? draft.serverCustomerId,
    updatedAt: store.nowIso(),
  };
  await store.putDraft(next);
  return next;
}

export async function drainCollectionQueue(input: {
  store: OfflineDraftStore;
  commands: OfflineSyncCommands;
  actor: CaptureActor;
  collectionId: string;
  staleRetry?: boolean;
}): Promise<"completed" | "paused" | "failed"> {
  const { store, commands, actor, collectionId } = input;
  const staleRetry = input.staleRetry ?? false;
  let draft = await store.getDraft(collectionId, actor.userId);
  if (draft === null) {
    return "completed";
  }

  const mutations = (await store.listMutations(collectionId, actor.userId)).filter(
    (row) => row.status === "pending" || row.status === "failed",
  );

  await store.putDraft({ ...draft, syncStatus: "syncing", updatedAt: store.nowIso() });

  for (const mutation of mutations) {
    draft = await store.getDraft(collectionId, actor.userId);
    if (draft === null) {
      return "completed";
    }

    const inFlight: OfflineMutationRecord = { ...mutation, status: "in_flight" };
    await store.putMutation(inFlight);

    const outcome = await replayMutation(store, commands, draft, inFlight);
    if (outcome.kind === "auth") {
      await markFailed(store, inFlight, draft, AUTH_ERROR);
      return "paused";
    }
    if (outcome.kind === "stale") {
      if (staleRetry) {
        await markFailed(store, inFlight, draft, STALE_RETRY_ONCE);
        return "failed";
      }
      await refreshVersion(store, commands, draft);
      await store.putMutation({ ...inFlight, status: "pending" });
      return drainCollectionQueue({ store, commands, actor, collectionId, staleRetry: true });
    }
    if (outcome.kind === "error") {
      await markFailed(store, inFlight, draft, outcome.error);
      return "failed";
    }
    if (outcome.kind === "purged") {
      await store.deleteDraftTree(collectionId, actor.userId);
      return "completed";
    }
    await markDone(store, inFlight);
    if (outcome.draft) {
      await store.putDraft({ ...outcome.draft, syncStatus: "queued", lastError: null, updatedAt: store.nowIso() });
    }
  }

  const leftover = (await store.listMutations(collectionId, actor.userId)).filter(
    (row) => row.status === "pending" || row.status === "failed" || row.status === "in_flight",
  );
  const latest = await store.getDraft(collectionId, actor.userId);
  if (latest && leftover.length === 0) {
    await store.putDraft({ ...latest, syncStatus: "synced", lastError: null, updatedAt: store.nowIso() });
  }
  return leftover.length === 0 ? "completed" : "failed";
}

async function replayMutation(
  store: OfflineDraftStore,
  commands: OfflineSyncCommands,
  draft: OfflineDraftRecord,
  mutation: OfflineMutationRecord,
): Promise<
  | { kind: "ok"; draft?: OfflineDraftRecord }
  | { kind: "purged" }
  | { kind: "stale" }
  | { kind: "auth" }
  | { kind: "error"; error: string }
> {
  const expectedVersion = draft.serverRowVersion ?? 1;

  if (mutation.kind === "create_customer") {
    const payload = createCustomerPayloadSchema.parse(mutation.payload);
    const result = await commands.createCustomer(payload);
    if (!isSuccess(result)) {
      if (result.error === "duplicate_tax_id") {
        const found = await commands.searchCustomers(payload.taxId);
        if (!isSuccess(found)) {
          return classify(found.error);
        }
        const match = found.customers.find((customer) => customer.taxId === payload.taxId);
        if (!match) {
          return { kind: "error", error: "duplicate_tax_id" };
        }
        return { kind: "ok", draft: { ...draft, serverCustomerId: match.id } };
      }
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverCustomerId: result.customerId } };
  }

  if (mutation.kind === "create_draft") {
    const payload = createDraftPayloadSchema.parse(mutation.payload);
    const customerId = draft.serverCustomerId ?? (draft.customer.mode === "existing" ? draft.customer.customerId : null);
    if (customerId === null) {
      return { kind: "error", error: "customer_required" };
    }
    const result = await commands.createDraft({ draftId: payload.draftId, customerId });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverRowVersion: result.rowVersion, serverCustomerId: customerId } };
  }

  if (mutation.kind === "patch_draft") {
    const payload = patchDraftPayloadSchema.parse(mutation.payload);
    const result = await commands.patchDraft({
      collectionId: draft.id,
      expectedVersion,
      ...(payload.collectionLocation === undefined ? {} : { collectionLocation: payload.collectionLocation }),
      ...(payload.responsibleName === undefined ? {} : { responsibleName: payload.responsibleName }),
      ...(payload.responsibleTaxId === undefined ? {} : { responsibleTaxId: payload.responsibleTaxId }),
      ...(payload.collectedAt === undefined ? {} : { collectedAt: payload.collectedAt }),
      ...(payload.customerId === undefined ? {} : { customerId: payload.customerId }),
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverRowVersion: result.rowVersion } };
  }

  if (mutation.kind === "add_item") {
    const payload = itemPayloadSchema.parse(mutation.payload);
    if (payload.description === undefined || payload.quantity === undefined) {
      return { kind: "error", error: "item_payload_invalid" };
    }
    const result = await commands.addItem({
      collectionId: draft.id,
      expectedVersion,
      clientItemId: payload.itemId,
      description: payload.description,
      quantity: payload.quantity,
      condition: payload.condition ?? null,
      notes: payload.notes ?? null,
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverRowVersion: result.rowVersion } };
  }

  if (mutation.kind === "patch_item") {
    const payload = itemPayloadSchema.parse(mutation.payload);
    const result = await commands.patchItem({
      collectionId: draft.id,
      itemId: payload.itemId,
      expectedVersion,
      ...(payload.description === undefined ? {} : { description: payload.description }),
      ...(payload.quantity === undefined ? {} : { quantity: payload.quantity }),
      ...(payload.condition === undefined ? {} : { condition: payload.condition }),
      ...(payload.notes === undefined ? {} : { notes: payload.notes }),
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverRowVersion: result.rowVersion } };
  }

  if (mutation.kind === "remove_item") {
    const payload = itemPayloadSchema.parse(mutation.payload);
    const result = await commands.removeItem({
      collectionId: draft.id,
      itemId: payload.itemId,
      expectedVersion,
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, serverRowVersion: result.rowVersion } };
  }

  if (mutation.kind === "save_signature") {
    if (draft.hasServerSignature) {
      return { kind: "ok", draft };
    }
    const fetched = await commands.fetchDraft(draft.id);
    if (isSuccess(fetched) && fetched.hasSignature) {
      return { kind: "ok", draft: { ...draft, hasServerSignature: true, serverRowVersion: fetched.draft.rowVersion } };
    }
    const payload = saveSignaturePayloadSchema.parse(mutation.payload);
    const blob = await store.getSignature(draft.id, draft.userId);
    if (blob === null) {
      return { kind: "error", error: "signature_missing" };
    }
    const result = await commands.saveSignature({
      collectionId: draft.id,
      expectedVersion: isSuccess(fetched) ? fetched.draft.rowVersion : expectedVersion,
      signerName: payload.signerName,
      signerTaxId: payload.signerTaxId,
      acceptanceText: payload.acceptanceText,
      signatureBase64Png: blob.dataUrl,
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "ok", draft: { ...draft, hasServerSignature: true, serverRowVersion: result.rowVersion } };
  }

  if (mutation.kind === "finalize") {
    const payload = finalizePayloadSchema.parse(mutation.payload);
    const result = await commands.finalize({
      collectionId: draft.id,
      expectedVersion,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!isSuccess(result)) {
      return classify(result.error);
    }
    return { kind: "purged" };
  }

  return { kind: "error", error: "unknown_mutation" };
}

function classify(error: string): { kind: "stale" } | { kind: "auth" } | { kind: "error"; error: string } {
  if (error === STALE_RETRY_ONCE) {
    return { kind: "stale" };
  }
  if (error === AUTH_ERROR) {
    return { kind: "auth" };
  }
  return { kind: "error", error };
}

export async function drainAllPending(input: {
  store: OfflineDraftStore;
  commands: OfflineSyncCommands;
  actor: CaptureActor;
  lock?: DrainLock;
}): Promise<void> {
  const lock = input.lock ?? fallbackDrainLock;
  await lock.request("mjt-offline-drain", async () => {
    await input.store.refreshSnapshot(input.actor.userId, true);
    const pending = await input.store.listPendingMutations(input.actor.userId);
    const collectionIds = [...new Set(pending.map((row) => row.collectionId))];
    for (const collectionId of collectionIds) {
      await drainCollectionQueue({
        store: input.store,
        commands: input.commands,
        actor: input.actor,
        collectionId,
      });
    }
    await input.store.refreshSnapshot(input.actor.userId, false);
  });
}
