import { afterEach, describe, expect, it } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { hydrateServerDraft } from "@/_pages/collection-drafts/model/offline-capture";
import { offlineDatabaseSchema, type OfflineCustomer } from "@/_pages/collection-drafts/model/offline-records";
import { createOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-store";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";
import type { DraftDTO } from "@/_pages/collection-drafts/model/draft";

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";
const customerId = "44444444-4444-4444-8444-444444444444";

const draft: DraftDTO = {
  id: collectionId,
  customerId,
  status: "draft",
  collectionLocation: "Rua da Oficina",
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  rowVersion: 3,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

const realCustomer: OfflineCustomer = {
  mode: "existing",
  customerId,
  displayName: "Oficina Norte",
  taxId: "52998224725",
  phone: "11998765432",
  street: "Rua Augusta",
  city: "Campinas",
  stateCode: "SP",
};

describe("hydrateServerDraft", () => {
  afterEach(() => {
    resetOfflineSnapshotForTests();
  });

  it("persists the real customer identity without placeholder PII", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    const record = await hydrateServerDraft({
      store,
      actor,
      draft,
      items: [],
      hasSignature: false,
      step: "itens",
      customer: realCustomer,
    });
    expect(record.customer.taxId).toBe("52998224725");
    expect(record.customer.phone).toBe("11998765432");
    expect(record.customer.mode).toBe("existing");
    if (record.customer.mode === "existing") {
      expect(record.customer.customerId).toBe(customerId);
    }
    expect(JSON.stringify(record)).not.toContain("00000000000");
    expect(JSON.stringify(record)).not.toContain("11000000000");
  });

  it("refuses to persist an invented CPF placeholder", async () => {
    const store = createOfflineDraftStore(createMemoryOfflinePort(offlineDatabaseSchema));
    await expect(
      hydrateServerDraft({
        store,
        actor,
        draft,
        items: [],
        hasSignature: false,
        step: "itens",
        customer: {
          ...realCustomer,
          taxId: "00000000000",
        },
      }),
    ).rejects.toThrow("customer_identity_invalid");
    expect(await store.getDraft(collectionId, actor.userId)).toBeNull();
  });
});
