import { describe, expect, it } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { createOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-store";
import { setDraftStep } from "@/_pages/collection-drafts/model/offline-capture";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";

const draft: OfflineDraftRecord = {
  id: collectionId,
  userId: actor.userId,
  organizationId: 1,
  currentStep: "itens",
  customer: {
    mode: "existing",
    customerId: "44444444-4444-4444-8444-444444444444",
    displayName: "Oficina Norte",
    taxId: "52998224725",
    phone: "11998765432",
    street: null,
  },
  collectionLocation: "Rua da Oficina",
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  serverRowVersion: 1,
  serverCustomerId: "44444444-4444-4444-8444-444444444444",
  hasServerSignature: false,
  finalizeIdempotencyKey: "33333333-3333-4333-8333-333333333333",
  syncStatus: "queued",
  lastError: null,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

describe("setDraftStep", () => {
  it("persists the next wizard step", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await store.putDraft(draft);
    await setDraftStep(store, actor, collectionId, "revisao");
    const updated = await store.getDraft(collectionId, actor.userId);
    expect(updated?.currentStep).toBe("revisao");
  });

  it("fails when the local draft is missing", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await expect(setDraftStep(store, actor, collectionId, "revisao")).rejects.toThrow("draft_not_found");
  });
});
