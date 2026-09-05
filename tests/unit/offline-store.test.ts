import { afterEach, describe, expect, it } from "vitest";
import { createMemoryOfflinePort, createThrowingQuotaPort, OfflineQuotaExceededError } from "@/shared/lib/offline";
import { canReloadFromSnapshot, getOfflineSnapshot, resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";
import { createOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-store";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { createLocalDraft, addLocalItem } from "@/_pages/collection-drafts/model/offline-capture";

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };

function draftFixture(overrides: Partial<OfflineDraftRecord> = {}): OfflineDraftRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
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
    serverRowVersion: null,
    serverCustomerId: null,
    hasServerSignature: false,
    finalizeIdempotencyKey: "33333333-3333-4333-8333-333333333333",
    syncStatus: "queued",
    lastError: null,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
    ...overrides,
  };
}

describe("offline draft store", () => {
  afterEach(() => {
    resetOfflineSnapshotForTests();
  });

  it("persists a local draft and ignores records from another user", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    const created = await createLocalDraft({
      store,
      actor,
      customer: {
        mode: "new",
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
      },
      collectionLocation: "Rua A",
    });

    const mine = await store.getDraft(created.id, actor.userId);
    const other = await store.getDraft(created.id, "99999999-9999-4999-8999-999999999999");
    expect(mine?.collectionLocation).toBe("Rua A");
    expect(other).toBeNull();
    const mutations = await store.listMutations(created.id, actor.userId);
    expect(mutations.map((row) => row.kind)).toEqual(["create_customer", "create_draft", "patch_draft"]);
  });

  it("keeps customer.street and collectionLocation distinct", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    const created = await createLocalDraft({
      store,
      actor,
      customer: {
        mode: "new",
        displayName: "Oficina Norte",
        taxId: "52998224725",
        phone: "11999999999",
        street: "Av. Cadastral, 100",
      },
      collectionLocation: "Galpão da coleta — portão 2",
    });

    const mine = await store.getDraft(created.id, actor.userId);
    expect(mine?.customer.street).toBe("Av. Cadastral, 100");
    expect(mine?.collectionLocation).toBe("Galpão da coleta — portão 2");
    expect(mine?.customer.street).not.toBe(mine?.collectionLocation);
  });

  it("keeps a stable finalize idempotency key", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    const created = await createLocalDraft({
      store,
      actor,
      customer: {
        mode: "existing",
        customerId: "44444444-4444-4444-8444-444444444444",
        displayName: "Cliente",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
      },
      collectionLocation: null,
    });
    expect(created.finalizeIdempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    const again = await store.getDraft(created.id, actor.userId);
    expect(again?.finalizeIdempotencyKey).toBe(created.finalizeIdempotencyKey);
  });

  it("updates the snapshot so canReload is false while work is pending", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftFixture());
    await store.enqueue({
      collectionId: "22222222-2222-4222-8222-222222222222",
      userId: actor.userId,
      kind: "create_draft",
      payload: { draftId: "22222222-2222-4222-8222-222222222222" },
    });
    await store.refreshSnapshot(actor.userId);
    expect(getOfflineSnapshot().pendingCount).toBe(1);
    expect(canReloadFromSnapshot()).toBe(false);
  });

  it("does not hydrate a record stored for another userId", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draftFixture({ userId: "99999999-9999-4999-8999-999999999999" }));
    expect(await store.getDraft(draftFixture().id, actor.userId)).toBeNull();
    expect(await store.listDrafts(actor.userId)).toEqual([]);
  });

  it("queues add_item with the client item id", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    const created = await createLocalDraft({
      store,
      actor,
      customer: {
        mode: "existing",
        customerId: "44444444-4444-4444-8444-444444444444",
        displayName: "Cliente",
        taxId: "52998224725",
        phone: "11999999999",
        street: null,
      },
      collectionLocation: null,
    });
    const item = await addLocalItem({
      store,
      actor,
      collectionId: created.id,
      description: "Motor",
      quantity: 1,
      condition: "Usado",
      notes: null,
    });
    const queued = await store.listMutations(created.id, actor.userId);
    const add = queued.find((row) => row.kind === "add_item");
    expect(add?.payload).toMatchObject({ itemId: item.id, description: "Motor" });
  });

  it("surfaces quota errors from the port", async () => {
    const store = createOfflineDraftStore(createThrowingQuotaPort(offlineDatabaseSchema));
    await expect(
      store.putDraft(draftFixture()),
    ).rejects.toBeInstanceOf(OfflineQuotaExceededError);
  });
});
