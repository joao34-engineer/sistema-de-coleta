import { normalizeDigits } from "@/shared/lib/cnpj";
import { isValidCpfOrCnpj } from "@/shared/lib/cpf";
import type { CaptureActor, CaptureStep } from "./capture-actor";
import type { OfflineCustomer, OfflineDraftRecord, OfflineItemRecord } from "./offline-records";
import type { OfflineDraftStore } from "./offline-store";
import { isOfflineQuotaExceeded } from "@/shared/lib/offline";
import type { DraftDTO, DraftItemDTO } from "./draft";

export function normalizeTaxId(value: string): string {
  return normalizeDigits(value);
}

export function asStoredTaxId(value: string | null | undefined): string | null {
  const digits = normalizeTaxId(value ?? "");
  return /^\d{11}$|^\d{14}$/.test(digits) ? digits : null;
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export const DEFAULT_ACCEPTANCE_TEXT =
  "Declaro que acompanhei a coleta das peças e equipamentos discriminados nesta guia, atestando a exatidão das quantidades e observações registradas.";

export async function createLocalDraft(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  customer: OfflineCustomer;
  collectionLocation: string | null;
}): Promise<OfflineDraftRecord> {
  const createdAt = input.store.nowIso();
  const record: OfflineDraftRecord = {
    id: crypto.randomUUID(),
    userId: input.actor.userId,
    organizationId: input.actor.organizationId,
    currentStep: "itens",
    customer: input.customer,
    collectionLocation: input.collectionLocation,
    responsibleName: null,
    responsibleTaxId: null,
    collectedAt: null,
    serverRowVersion: null,
    serverCustomerId: input.customer.mode === "existing" ? input.customer.customerId : null,
    hasServerSignature: false,
    finalizeIdempotencyKey: crypto.randomUUID(),
    syncStatus: "queued",
    lastError: null,
    createdAt,
    updatedAt: createdAt,
  };
  try {
    await input.store.putDraft(record);
    if (input.customer.mode === "new") {
      const city = input.customer.city?.trim() ?? "";
      const stateCode = input.customer.stateCode?.trim().toUpperCase() ?? "";
      await input.store.enqueue({
        collectionId: record.id,
        userId: input.actor.userId,
        kind: "create_customer",
        payload: {
          displayName: input.customer.displayName,
          taxId: input.customer.taxId,
          phone: input.customer.phone,
          street: input.customer.street,
          ...(city === "" ? {} : { city }),
          ...(stateCode === "" ? {} : { stateCode }),
        },
      });
    }
    await input.store.enqueue({
      collectionId: record.id,
      userId: input.actor.userId,
      kind: "create_draft",
      payload: { draftId: record.id },
    });
    if (input.collectionLocation) {
      await input.store.enqueue({
        collectionId: record.id,
        userId: input.actor.userId,
        kind: "patch_draft",
        payload: { collectionLocation: input.collectionLocation },
      });
    }
    await input.store.refreshSnapshot(input.actor.userId);
    return record;
  } catch (error: unknown) {
    if (isOfflineQuotaExceeded(error)) {
      throw error;
    }
    throw error;
  }
}

export async function addLocalItem(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  collectionId: string;
  description: string;
  quantity: number;
  condition: string | null;
  notes: string | null;
}): Promise<OfflineItemRecord> {
  const createdAt = input.store.nowIso();
  const record: OfflineItemRecord = {
    id: crypto.randomUUID(),
    collectionId: input.collectionId,
    userId: input.actor.userId,
    description: input.description,
    quantity: input.quantity,
    condition: input.condition,
    notes: input.notes,
    removed: false,
    createdAt,
    updatedAt: createdAt,
  };
  await input.store.putItem(record);
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "add_item",
    payload: {
      itemId: record.id,
      description: record.description,
      quantity: record.quantity,
      condition: record.condition,
      notes: record.notes,
    },
  });
  await markQueued(input.store, input.collectionId, input.actor.userId);
  return record;
}

export async function patchLocalDraft(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  collectionId: string;
  collectionLocation: string;
}): Promise<OfflineDraftRecord> {
  const draft = await input.store.getDraft(input.collectionId, input.actor.userId);
  if (draft === null) {
    throw new Error("draft_not_found");
  }
  const trimmed = input.collectionLocation.trim();
  const next: OfflineDraftRecord = {
    ...draft,
    collectionLocation: trimmed === "" ? null : trimmed,
    updatedAt: input.store.nowIso(),
  };
  await input.store.putDraft(next);
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "patch_draft",
    payload: { collectionLocation: next.collectionLocation },
  });
  await markQueued(input.store, input.collectionId, input.actor.userId);
  return next;
}

export async function updateLocalItem(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  item: OfflineItemRecord;
  description: string;
  quantity: number;
  condition: string | null;
  notes: string | null;
}): Promise<OfflineItemRecord> {
  const next: OfflineItemRecord = {
    ...input.item,
    description: input.description,
    quantity: input.quantity,
    condition: input.condition,
    notes: input.notes,
    updatedAt: input.store.nowIso(),
  };
  await input.store.putItem(next);
  await input.store.enqueue({
    collectionId: next.collectionId,
    userId: input.actor.userId,
    kind: "patch_item",
    payload: {
      itemId: next.id,
      description: next.description,
      quantity: next.quantity,
      condition: next.condition,
      notes: next.notes,
    },
  });
  await markQueued(input.store, next.collectionId, input.actor.userId);
  return next;
}

export async function removeLocalItem(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  item: OfflineItemRecord;
}): Promise<void> {
  await input.store.putItem({ ...input.item, removed: true, updatedAt: input.store.nowIso() });
  await input.store.enqueue({
    collectionId: input.item.collectionId,
    userId: input.actor.userId,
    kind: "remove_item",
    payload: { itemId: input.item.id },
  });
  await markQueued(input.store, input.item.collectionId, input.actor.userId);
}

export async function saveLocalSignature(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  collectionId: string;
  signerName: string;
  signerTaxId: string;
  acceptanceText: string;
  dataUrl: string;
}): Promise<void> {
  const draft = await input.store.getDraft(input.collectionId, input.actor.userId);
  if (draft === null) {
    throw new Error("draft_not_found");
  }
  const collectedAt = draft.collectedAt ?? input.store.nowIso();
  await input.store.putDraft({
    ...draft,
    currentStep: "assinatura",
    responsibleName: input.signerName,
    responsibleTaxId: input.signerTaxId,
    collectedAt,
    syncStatus: "queued",
    updatedAt: input.store.nowIso(),
  });
  await input.store.putSignature({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    dataUrl: input.dataUrl,
  });
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "patch_draft",
    payload: {
      responsibleName: input.signerName,
      responsibleTaxId: input.signerTaxId,
      collectedAt,
      ...(draft.collectionLocation ? { collectionLocation: draft.collectionLocation } : {}),
    },
  });
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "save_signature",
    payload: {
      signerName: input.signerName,
      signerTaxId: input.signerTaxId,
      acceptanceText: input.acceptanceText,
    },
  });
  await input.store.enqueue({
    collectionId: input.collectionId,
    userId: input.actor.userId,
    kind: "finalize",
    payload: { idempotencyKey: draft.finalizeIdempotencyKey ?? crypto.randomUUID() },
  });
  await input.store.refreshSnapshot(input.actor.userId);
}

export async function setDraftStep(
  store: OfflineDraftStore,
  actor: CaptureActor,
  collectionId: string,
  currentStep: CaptureStep,
): Promise<void> {
  const draft = await store.getDraft(collectionId, actor.userId);
  if (draft === null) {
    return;
  }
  await store.putDraft({ ...draft, currentStep, updatedAt: store.nowIso() });
}

export async function hydrateServerDraft(input: {
  store: OfflineDraftStore;
  actor: CaptureActor;
  draft: DraftDTO;
  items: readonly DraftItemDTO[];
  hasSignature: boolean;
  step: CaptureStep;
  customer: OfflineCustomer;
}): Promise<OfflineDraftRecord> {
  const existing = await input.store.getDraft(input.draft.id, input.actor.userId);
  const pending = existing ? await input.store.listMutations(input.draft.id, input.actor.userId) : [];
  const hasPending = pending.some((row) => row.status !== "done");
  if (existing && hasPending) {
    return existing;
  }
  const createdAt = existing?.createdAt ?? input.draft.createdAt;
  const taxId = asStoredTaxId(input.customer.taxId);
  if (taxId === null || !isValidCpfOrCnpj(taxId)) {
    throw new Error("customer_identity_invalid");
  }
  const street = input.customer.street === null ? null : input.customer.street.slice(0, 160);
  const record: OfflineDraftRecord = {
    id: input.draft.id,
    userId: input.actor.userId,
    organizationId: input.actor.organizationId,
    currentStep: input.step,
    customer: {
      ...input.customer,
      taxId,
      street,
    },
    collectionLocation: input.draft.collectionLocation,
    responsibleName: input.draft.responsibleName,
    responsibleTaxId: asStoredTaxId(input.draft.responsibleTaxId),
    collectedAt: input.draft.collectedAt,
    serverRowVersion: input.draft.rowVersion,
    serverCustomerId: input.draft.customerId,
    hasServerSignature: input.hasSignature,
    finalizeIdempotencyKey: existing?.finalizeIdempotencyKey ?? crypto.randomUUID(),
    syncStatus: "synced",
    lastError: null,
    createdAt,
    updatedAt: input.store.nowIso(),
  };
  await input.store.putDraft(record);
  for (const item of input.items) {
    await input.store.putItem({
      id: item.id,
      collectionId: input.draft.id,
      userId: input.actor.userId,
      description: item.description,
      quantity: item.quantity,
      condition: item.condition,
      notes: item.notes,
      removed: false,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
  await input.store.refreshSnapshot(input.actor.userId);
  return record;
}

async function markQueued(store: OfflineDraftStore, collectionId: string, userId: string): Promise<void> {
  const draft = await store.getDraft(collectionId, userId);
  if (draft) {
    await store.putDraft({ ...draft, syncStatus: "queued", lastError: null, updatedAt: store.nowIso() });
  }
  await store.refreshSnapshot(userId);
}
