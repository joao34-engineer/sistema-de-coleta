import type { OfflineDraftStore } from "./offline-store";
import type { OfflineSyncCommands } from "./offline-commands";
import type { CaptureActor } from "./capture-actor";
import { hasRequiredCollectionLocation } from "./has-required-collection-location";
import {
  createCustomerPayloadSchema,
  createDraftPayloadSchema,
  discardDraftPayloadSchema,
  finalizePayloadSchema,
  itemPayloadSchema,
  patchDraftPayloadSchema,
  saveSignaturePayloadSchema,
  type OfflineDraftRecord,
  type OfflineMutationRecord,
} from "./offline-records";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";

const STALE_RETRY_ONCE = "stale_version";
const AUTH_ERROR = "authentication_required";
const SYNC_INTERRUPTED = "sync_interrupted";
const VALIDATION_ERROR = "validation_error";
const COLLECTION_INCOMPLETE = "collection_incomplete";
const CANCELLED_BY_DISCARD = "cancelled_by_discard";
const INVALID_SIGNER_TAX_ID = "invalid_signer_tax_id";

function isUnfinishedMutation(row: OfflineMutationRecord): boolean {
  return row.status === "pending" || row.status === "failed" || row.status === "in_flight";
}

function isTerminalValidation(error: string): boolean {
  return error === COLLECTION_INCOMPLETE || error === VALIDATION_ERROR || error === INVALID_SIGNER_TAX_ID;
}

function pickUnfinishedDiscard(
  rows: readonly OfflineMutationRecord[],
): OfflineMutationRecord | null {
  const discards = rows
    .filter((row) => row.kind === "discard_draft" && isUnfinishedMutation(row))
    .sort((left, right) => left.sequence - right.sequence);
  return discards[0] ?? null;
}

async function cancelUnfinishedExcept(
  store: OfflineDraftStore,
  rows: readonly OfflineMutationRecord[],
  keepId: string,
): Promise<void> {
  for (const row of rows) {
    if (row.id !== keepId && isUnfinishedMutation(row)) {
      await store.putMutation({
        ...row,
        status: "done",
        lastError: CANCELLED_BY_DISCARD,
      });
    }
  }
}

/** Apply patch/item work before finalize so a later location patch can unblock emit. */
function orderMutationsForDrain(
  rows: readonly OfflineMutationRecord[],
): OfflineMutationRecord[] {
  const work = rows.filter((row) => row.status === "pending" || row.status === "failed");
  const beforeFinalize = work.filter((row) => row.kind !== "finalize");
  const finalizes = work.filter((row) => row.kind === "finalize");
  return [...beforeFinalize, ...finalizes];
}

export type DrainLock = {
  request(name: string, callback: () => Promise<void>): Promise<void>;
};

export function createFallbackDrainLock(): DrainLock {
  const queue = { tail: Promise.resolve() };
  return {
    async request(_name, callback) {
      const previous = queue.tail;
      let release = () => {};
      queue.tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      try {
        await previous;
        await callback();
      } finally {
        release();
      }
    },
  };
}

export const fallbackDrainLock = createFallbackDrainLock();

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
  const sameTerminal = isTerminalValidation(error) && mutation.lastError === error;
  await store.putMutation({
    ...mutation,
    status: "failed",
    attempts: sameTerminal ? mutation.attempts : mutation.attempts + 1,
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

export type DrainCollectionResult = Readonly<{
  status: "completed" | "paused" | "failed";
  officialKept: boolean;
}>;

export type DrainPendingResult = Readonly<{
  officialKept: boolean;
}>;

export async function drainCollectionQueue(input: {
  store: OfflineDraftStore;
  commands: OfflineSyncCommands;
  actor: CaptureActor;
  collectionId: string;
  staleRetry?: boolean;
}): Promise<DrainCollectionResult> {
  const { store, commands, actor, collectionId } = input;
  const staleRetry = input.staleRetry ?? false;
  let draft = await store.getDraft(collectionId, actor.userId);
  if (draft === null) {
    return { status: "completed", officialKept: false };
  }

  const listed = await store.listMutations(collectionId, actor.userId);
  const discardWinner = pickUnfinishedDiscard(listed);
  if (discardWinner) {
    // Discard must win: a failed finalize must not block the human's discard.
    await cancelUnfinishedExcept(store, listed, discardWinner.id);
  }
  const mutations = discardWinner
    ? [
        discardWinner.status === "in_flight"
          ? { ...discardWinner, status: "pending" as const }
          : discardWinner,
      ].filter((row) => row.status === "pending" || row.status === "failed")
    : orderMutationsForDrain(listed);

  await store.putDraft({ ...draft, syncStatus: "syncing", updatedAt: store.nowIso() });

  for (const mutation of mutations) {
    draft = await store.getDraft(collectionId, actor.userId);
    if (draft === null) {
      return { status: "completed", officialKept: false };
    }

    if (mutation.kind === "finalize" && !hasRequiredCollectionLocation(draft.collectionLocation)) {
      await store.putMutation({
        ...mutation,
        status: "failed",
        lastError: COLLECTION_INCOMPLETE,
      });
      await store.putDraft({
        ...draft,
        syncStatus: "failed",
        lastError: COLLECTION_INCOMPLETE,
        updatedAt: store.nowIso(),
      });
      return { status: "failed", officialKept: false };
    }

    const inFlight: OfflineMutationRecord = { ...mutation, status: "in_flight" };
    await store.putMutation(inFlight);

    const outcome = await replayMutation(store, commands, draft, inFlight);
    if (outcome.kind === "auth") {
      await markFailed(store, inFlight, draft, AUTH_ERROR);
      return { status: "paused", officialKept: false };
    }
    if (outcome.kind === "stale") {
      if (staleRetry) {
        await markFailed(store, inFlight, draft, STALE_RETRY_ONCE);
        return { status: "failed", officialKept: false };
      }
      await refreshVersion(store, commands, draft);
      await store.putMutation({ ...inFlight, status: "pending" });
      return drainCollectionQueue({ store, commands, actor, collectionId, staleRetry: true });
    }
    if (outcome.kind === "error") {
      await markFailed(store, inFlight, draft, outcome.error);
      return { status: "failed", officialKept: false };
    }
    if (outcome.kind === "purged") {
      await store.deleteDraftTree(collectionId, actor.userId);
      return { status: "completed", officialKept: outcome.reason === "official_kept" };
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
  const interrupted = leftover.filter((row) => row.status === "in_flight");
  for (const row of interrupted) {
    await store.putMutation({ ...row, status: "pending" });
  }
  if (latest && leftover.length === 0) {
    await store.putDraft({ ...latest, syncStatus: "synced", lastError: null, updatedAt: store.nowIso() });
  } else if (latest && interrupted.length > 0) {
    await store.putDraft({
      ...latest,
      syncStatus: "failed",
      lastError: SYNC_INTERRUPTED,
      updatedAt: store.nowIso(),
    });
  } else if (latest && leftover.length > 0) {
    const mutationError = leftover.find(
      (row) => row.lastError !== null && row.lastError !== undefined && row.lastError.trim() !== "",
    )?.lastError;
    const draftError =
      latest.lastError !== null && latest.lastError !== undefined && latest.lastError.trim() !== ""
        ? latest.lastError
        : null;
    const lastError = draftError ?? mutationError ?? VALIDATION_ERROR;
    await store.putDraft({
      ...latest,
      syncStatus: "failed",
      lastError,
      updatedAt: store.nowIso(),
    });
  }
  return leftover.length === 0
    ? { status: "completed", officialKept: false }
    : { status: "failed", officialKept: false };
}

export async function recoverInFlightMutations(store: OfflineDraftStore, userId: string): Promise<void> {
  const pending = await store.listPendingMutations(userId);
  for (const row of pending) {
    if (row.status === "in_flight") {
      await store.putMutation({ ...row, status: "pending" });
    }
  }
}

async function replayMutation(
  store: OfflineDraftStore,
  commands: OfflineSyncCommands,
  draft: OfflineDraftRecord,
  mutation: OfflineMutationRecord,
): Promise<
  | { kind: "ok"; draft?: OfflineDraftRecord }
  | { kind: "purged"; reason?: "official_kept" }
  | { kind: "stale" }
  | { kind: "auth" }
  | { kind: "error"; error: string }
> {
  const expectedVersion = draft.serverRowVersion ?? 1;

  if (mutation.kind === "create_customer") {
    const parsed = createCustomerPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
    const result = await commands.createCustomer({
      displayName: payload.displayName,
      taxId: payload.taxId,
      phone: payload.phone,
      street: payload.street,
      ...(payload.city === undefined ? {} : { city: payload.city }),
      ...(payload.stateCode === undefined ? {} : { stateCode: payload.stateCode }),
    });
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
    const parsed = createDraftPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
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
    const parsed = patchDraftPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return {
        kind: "error",
        error: zodIssueTouchesKey(parsed.error, "responsibleTaxId") ? INVALID_SIGNER_TAX_ID : VALIDATION_ERROR,
      };
    }
    const payload = parsed.data;
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
    return {
      kind: "ok",
      draft: {
        ...draft,
        serverRowVersion: result.rowVersion,
        ...(payload.collectionLocation === undefined
          ? {}
          : { collectionLocation: payload.collectionLocation }),
        ...(payload.responsibleName === undefined ? {} : { responsibleName: payload.responsibleName }),
        ...(payload.responsibleTaxId === undefined ? {} : { responsibleTaxId: payload.responsibleTaxId }),
        ...(payload.collectedAt === undefined ? {} : { collectedAt: payload.collectedAt }),
      },
    };
  }

  if (mutation.kind === "add_item") {
    const parsed = itemPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
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
    const parsed = itemPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
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
    const parsed = itemPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
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
    const parsed = saveSignaturePayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return {
        kind: "error",
        error: zodIssueTouchesKey(parsed.error, "signerTaxId") ? INVALID_SIGNER_TAX_ID : VALIDATION_ERROR,
      };
    }
    const payload = parsed.data;
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

  if (mutation.kind === "discard_draft") {
    const parsed = discardDraftPayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    if (draft.serverRowVersion === null) {
      return { kind: "purged" };
    }
    const result = await commands.discardDraft({
      collectionId: draft.id,
      expectedVersion: draft.serverRowVersion,
    });
    if (!isSuccess(result)) {
      if (
        result.error === "collection_not_draft" ||
        result.error === "not_found" ||
        result.error === "immutable_record"
      ) {
        return { kind: "purged", reason: "official_kept" };
      }
      return classify(result.error);
    }
    return { kind: "purged" };
  }

  if (mutation.kind === "finalize") {
    const parsed = finalizePayloadSchema.safeParse(mutation.payload);
    if (!parsed.success) {
      return { kind: "error", error: VALIDATION_ERROR };
    }
    const payload = parsed.data;
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
}): Promise<DrainPendingResult> {
  const lock = input.lock ?? fallbackDrainLock;
  let officialKept = false;
  await lock.request("mjt-offline-drain", async () => {
    await recoverInFlightMutations(input.store, input.actor.userId);
    await input.store.refreshSnapshot(input.actor.userId, true);
    const pending = await input.store.listPendingMutations(input.actor.userId);
    const collectionIds = [...new Set(pending.map((row) => row.collectionId))];
    for (const collectionId of collectionIds) {
      const drained = await drainCollectionQueue({
        store: input.store,
        commands: input.commands,
        actor: input.actor,
        collectionId,
      });
      if (drained.officialKept) {
        officialKept = true;
      }
    }
    await input.store.refreshSnapshot(input.actor.userId, false);
  });
  return { officialKept };
}
