import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { createOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-store";
import { drainCollectionQueue, type DrainPendingResult } from "@/_pages/collection-drafts/model/offline-runner";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import type { OfflineSyncCommands } from "@/_pages/collection-drafts/model/offline-commands";
import type { DraftDTO, DraftItemDTO } from "@/_pages/collection-drafts/model/draft";
import type { CaptureActor } from "@/_pages/collection-drafts/model/capture-actor";
import { discardLocalDraft } from "@/_pages/collection-drafts/model/discard-local-draft";

const { runAuthenticatedDrain } = vi.hoisted(() => ({
  runAuthenticatedDrain: vi.fn<(actor: CaptureActor) => Promise<DrainPendingResult>>(
    async () => ({ officialKept: false }),
  ),
}));

vi.mock("@/_pages/collection-drafts/model/run-authenticated-drain", () => ({
  runAuthenticatedDrain,
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  return {
    ...actual,
    isBrowserOnline: () => true,
  };
});

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";
const customerId = "44444444-4444-4444-8444-444444444444";
const itemId = "55555555-5555-4555-8555-555555555555";
const finalizeKey = "66666666-6666-4666-8666-666666666666";

function draftRecord(overrides: Partial<OfflineDraftRecord> = {}): OfflineDraftRecord {
  return {
    id: collectionId,
    userId: actor.userId,
    organizationId: 1,
    currentStep: "itens",
    customer: {
      mode: "new",
      displayName: "Oficina Norte",
      taxId: "52998224725",
      phone: "11999999999",
      street: null,
    },
    collectionLocation: null,
    responsibleName: null,
    responsibleTaxId: null,
    collectedAt: null,
    serverRowVersion: 4,
    serverCustomerId: customerId,
    hasServerSignature: false,
    finalizeIdempotencyKey: finalizeKey,
    syncStatus: "failed",
    lastError: "collection_incomplete",
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
    ...overrides,
  };
}

const sampleItem: DraftItemDTO = {
  id: itemId,
  description: "Motor",
  quantity: 1,
  condition: "Usado",
  notes: null,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

const sampleDraft: DraftDTO = {
  id: collectionId,
  customerId,
  status: "draft",
  collectionLocation: null,
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  rowVersion: 4,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

function commands(overrides: Partial<OfflineSyncCommands> = {}): OfflineSyncCommands {
  return {
    createCustomer: vi.fn(async () => ({ ok: true as const, customerId })),
    searchCustomers: vi.fn(async () => ({ ok: true as const, customers: [{ id: customerId, taxId: "52998224725" }] })),
    createDraft: vi.fn(async () => ({ ok: true as const, draftId: collectionId, rowVersion: 1 })),
    patchDraft: vi.fn(async () => ({ ok: true as const, rowVersion: 2 })),
    addItem: vi.fn(async () => ({ ok: true as const, item: sampleItem, rowVersion: 3 })),
    patchItem: vi.fn(async () => ({ ok: true as const, rowVersion: 4 })),
    removeItem: vi.fn(async () => ({ ok: true as const, rowVersion: 5 })),
    saveSignature: vi.fn(async () => ({ ok: true as const, rowVersion: 6 })),
    fetchDraft: vi.fn(async () => ({ ok: true as const, draft: sampleDraft, items: [sampleItem], hasSignature: false })),
    fetchCustomer: vi.fn(async () => ({
      ok: true as const,
      customer: {
        id: customerId,
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
        city: null,
        stateCode: null,
      },
    })),
    discardDraft: vi.fn(async () => ({ ok: true as const })),
    finalize: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

function bindAuthenticatedDrain(
  store: ReturnType<typeof createOfflineDraftStore>,
  sync: OfflineSyncCommands,
): void {
  runAuthenticatedDrain.mockImplementation(async (drainActor: CaptureActor) => {
    const drained = await drainCollectionQueue({
      store,
      commands: sync,
      actor: drainActor,
      collectionId,
    });
    return { officialKept: drained.officialKept };
  });
}

describe("discardLocalDraft", () => {
  afterEach(() => {
    resetOfflineSnapshotForTests();
    runAuthenticatedDrain.mockReset();
  });

  it("maps leftover collection_incomplete to operation_failed after confirm", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord());
    const finalizeMutation = await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "finalize",
      payload: { idempotencyKey: finalizeKey },
    });
    await store.putMutation({
      ...finalizeMutation,
      status: "failed",
      lastError: "collection_incomplete",
    });
    const firstDiscard = await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "discard_draft",
      payload: { expectedVersion: 4 },
    });
    runAuthenticatedDrain.mockResolvedValue({ officialKept: false });
    const result = await discardLocalDraft({ store, actor, collectionId });
    expect(result).toEqual({ ok: false, error: "operation_failed" });
    expect(result).not.toEqual({ ok: false, error: "collection_incomplete" });
    const discards = (await store.listMutations(collectionId, actor.userId)).filter(
      (row) => row.kind === "discard_draft",
    );
    expect(discards).toHaveLength(1);
    expect(discards[0]?.id).toBe(firstDiscard.id);
    expect(await store.getDraft(collectionId, actor.userId)).not.toBeNull();
  });

  it("returns ok when drain preempts a poisoned finalize with discard", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord());
    const finalizeMutation = await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "finalize",
      payload: { idempotencyKey: finalizeKey },
    });
    await store.putMutation({
      ...finalizeMutation,
      status: "failed",
      lastError: "collection_incomplete",
    });
    const finalize = vi.fn(async () => ({ ok: true as const }));
    const discardDraft = vi.fn(async () => ({ ok: true as const }));
    bindAuthenticatedDrain(store, commands({ finalize, discardDraft }));
    const result = await discardLocalDraft({ store, actor, collectionId });
    expect(result).toEqual({ ok: true });
    expect(finalize).not.toHaveBeenCalled();
    expect(discardDraft).toHaveBeenCalledOnce();
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });

  it("returns officialKept when the server draft is no longer a draft", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ lastError: null, syncStatus: "queued" }));
    const discardDraft = vi.fn(async () => ({ ok: false as const, error: "collection_not_draft" }));
    const finalize = vi.fn(async () => ({ ok: true as const }));
    bindAuthenticatedDrain(store, commands({ discardDraft, finalize }));
    const result = await discardLocalDraft({ store, actor, collectionId });
    expect(result).toEqual({ ok: true, officialKept: true });
    expect(finalize).not.toHaveBeenCalled();
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });
});
