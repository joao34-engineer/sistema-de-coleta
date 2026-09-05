import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { createOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-store";
import {
  createFallbackDrainLock,
  drainAllPending,
  drainCollectionQueue,
  fallbackDrainLock,
} from "@/_pages/collection-drafts/model/offline-runner";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import type { OfflineSyncCommands } from "@/_pages/collection-drafts/model/offline-commands";
import type { DraftDTO, DraftItemDTO } from "@/_pages/collection-drafts/model/draft";

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
    serverRowVersion: 1,
    serverCustomerId: null,
    hasServerSignature: false,
    finalizeIdempotencyKey: finalizeKey,
    syncStatus: "queued",
    lastError: null,
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
  rowVersion: 2,
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

describe("offline drain runner", () => {
  afterEach(() => {
    resetOfflineSnapshotForTests();
  });

  it("does not create a second item when add_item is replayed with the same client id", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverCustomerId: customerId }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "add_item",
      payload: { itemId, description: "Motor", quantity: 1, condition: "Usado", notes: null },
    });
    const addItem = vi.fn(async () => ({ ok: true as const, item: sampleItem, rowVersion: 3 }));
    const sync = commands({ addItem });
    await drainCollectionQueue({ store, commands: sync, actor, collectionId });
    const queued = await store.listMutations(collectionId, actor.userId);
    const first = queued[0];
    expect(first).toBeDefined();
    if (!first) {
      return;
    }
    await store.putMutation({
      ...first,
      status: "pending",
    });
    await drainCollectionQueue({ store, commands: sync, actor, collectionId });
    expect(addItem).toHaveBeenCalledTimes(2);
    expect(addItem).toHaveBeenNthCalledWith(1, expect.objectContaining({ clientItemId: itemId }));
    expect(addItem).toHaveBeenNthCalledWith(2, expect.objectContaining({ clientItemId: itemId }));
  });

  it("skips save_signature when the server already has a signature", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverCustomerId: customerId, hasServerSignature: true }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "save_signature",
      payload: {
        signerName: "Ana",
        signerTaxId: "52998224725",
        acceptanceText: "Declaro que acompanhei a coleta das peças e equipamentos.",
      },
    });
    const saveSignature = vi.fn(async () => ({ ok: true as const, rowVersion: 6 }));
    await drainCollectionQueue({
      store,
      commands: commands({ saveSignature }),
      actor,
      collectionId,
    });
    expect(saveSignature).not.toHaveBeenCalled();
  });

  it("retries a stale_version once after refetching the draft", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverCustomerId: customerId, serverRowVersion: 1 }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "patch_draft",
      payload: { collectionLocation: "Rua B" },
    });
    const patchDraft = vi
      .fn<OfflineSyncCommands["patchDraft"]>()
      .mockResolvedValueOnce({ ok: false, error: "stale_version" })
      .mockResolvedValueOnce({ ok: true, rowVersion: 4 });
    const fetchDraft = vi.fn(async () => ({
      ok: true as const,
      draft: { ...sampleDraft, rowVersion: 3 },
      items: [sampleItem],
      hasSignature: false,
    }));
    await drainCollectionQueue({
      store,
      commands: commands({ patchDraft, fetchDraft }),
      actor,
      collectionId,
    });
    expect(patchDraft).toHaveBeenCalledTimes(2);
    expect(fetchDraft).toHaveBeenCalled();
  });

  it("does not purge local data on authentication_required", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord());
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "create_customer",
      payload: {
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
      },
    });
    const result = await drainCollectionQueue({
      store,
      commands: commands({
        createCustomer: vi.fn(async () => ({ ok: false as const, error: "authentication_required" })),
      }),
      actor,
      collectionId,
    });
    expect(result).toEqual({ status: "paused", officialKept: false });
    expect(await store.getDraft(collectionId, actor.userId)).not.toBeNull();
  });

  it("purges the local tree after a successful finalize", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverCustomerId: customerId, serverRowVersion: 6 }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "finalize",
      payload: { idempotencyKey: finalizeKey },
    });
    const finalize = vi.fn(async (input: { idempotencyKey: string }) => {
      expect(input.idempotencyKey).toBe(finalizeKey);
      return { ok: true as const };
    });
    await drainAllPending({
      store,
      commands: commands({ finalize }),
      actor,
      lock: fallbackDrainLock,
    });
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });

  it("recovers duplicate_tax_id via search of the normalized tax id", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord());
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "create_customer",
      payload: {
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
      },
    });
    const searchCustomers = vi.fn(async (query: string) => {
      expect(query).toBe("52998224725");
      return { ok: true as const, customers: [{ id: customerId, taxId: "52998224725" }] };
    });
    await drainCollectionQueue({
      store,
      commands: commands({
        createCustomer: vi.fn(async () => ({ ok: false as const, error: "duplicate_tax_id" })),
        searchCustomers,
      }),
      actor,
      collectionId,
    });
    const updated = await store.getDraft(collectionId, actor.userId);
    expect(updated?.serverCustomerId).toBe(customerId);
    expect(searchCustomers).toHaveBeenCalledWith("52998224725");
  });

  it("recovers in_flight mutations when drainAllPending starts", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverCustomerId: customerId }));
    const mutation = await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "add_item",
      payload: { itemId, description: "Motor", quantity: 1, condition: "Usado", notes: null },
    });
    await store.putMutation({ ...mutation, status: "in_flight" });
    const addItem = vi.fn(async () => ({ ok: true as const, item: sampleItem, rowVersion: 3 }));
    await drainAllPending({
      store,
      commands: commands({ addItem }),
      actor,
      lock: createFallbackDrainLock(),
    });
    expect(addItem).toHaveBeenCalledOnce();
    const leftover = await store.listPendingMutations(actor.userId);
    expect(leftover).toHaveLength(0);
  });

  it("runs overlapping fallbackDrainLock requests in series", async () => {
    const lock = createFallbackDrainLock();
    const order: number[] = [];
    let releaseFirst = () => {};
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = lock.request("mjt-offline-drain", async () => {
      order.push(1);
      await firstHold;
      order.push(2);
    });
    let secondStarted = false;
    const second = lock.request("mjt-offline-drain", async () => {
      secondStarted = true;
      order.push(3);
    });

    await Promise.resolve();
    expect(secondStarted).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("replays discard_draft and purges the local tree", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverRowVersion: 1 }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "discard_draft",
      payload: { expectedVersion: 1 },
    });
    const discardDraft = vi.fn(async () => ({ ok: true as const }));
    await drainCollectionQueue({
      store,
      commands: commands({ discardDraft }),
      actor,
      collectionId,
    });
    expect(discardDraft).toHaveBeenCalledWith({ collectionId, expectedVersion: 1 });
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });

  it("purges a local discard when the server draft is no longer a draft", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverRowVersion: 2 }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "discard_draft",
      payload: { expectedVersion: 2 },
    });
    const result = await drainCollectionQueue({
      store,
      commands: commands({
        discardDraft: vi.fn(async () => ({ ok: false as const, error: "collection_not_draft" })),
      }),
      actor,
      collectionId,
    });
    expect(result).toEqual({ status: "completed", officialKept: true });
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });

  it("surfaces officialKept from drainAllPending after a non-draft discard", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftRecord({ serverRowVersion: 2 }));
    await store.enqueue({
      collectionId,
      userId: actor.userId,
      kind: "discard_draft",
      payload: { expectedVersion: 2 },
    });
    const drained = await drainAllPending({
      store,
      commands: commands({
        discardDraft: vi.fn(async () => ({ ok: false as const, error: "collection_not_draft" })),
      }),
      actor,
      lock: fallbackDrainLock,
    });
    expect(drained.officialKept).toBe(true);
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });
});
