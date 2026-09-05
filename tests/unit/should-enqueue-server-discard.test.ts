import { describe, expect, it } from "vitest";
import { shouldEnqueueServerDiscard } from "@/_pages/collection-drafts/model/should-enqueue-server-discard";
import type { OfflineDraftRecord, OfflineMutationRecord } from "@/_pages/collection-drafts/model/offline-records";

const draft: OfflineDraftRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
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
};

function mutation(status: OfflineMutationRecord["status"]): OfflineMutationRecord {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    collectionId: draft.id,
    userId: draft.userId,
    sequence: 0,
    kind: "create_draft",
    payload: { draftId: draft.id },
    status,
    attempts: 1,
    lastError: null,
    createdAt: "2026-08-27T12:00:00.000Z",
  };
}

describe("shouldEnqueueServerDiscard", () => {
  it("is false for a local-only draft", () => {
    expect(shouldEnqueueServerDiscard(draft, [])).toBe(false);
    expect(shouldEnqueueServerDiscard(draft, [mutation("pending")])).toBe(false);
  });

  it("is true when create_draft already touched the server", () => {
    expect(shouldEnqueueServerDiscard(draft, [mutation("done")])).toBe(true);
    expect(shouldEnqueueServerDiscard(draft, [mutation("in_flight")])).toBe(true);
  });

  it("is true when a server row version exists", () => {
    expect(shouldEnqueueServerDiscard({ ...draft, serverRowVersion: 1 }, [])).toBe(true);
  });
});
