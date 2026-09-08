import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_pages/collection-drafts/api/drafts.server", () => ({
  createDraft: vi.fn(),
  discardCollectionDraft: vi.fn(),
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  patchDraftFieldsAction: vi.fn(),
}));

vi.mock("@/_pages/collection-documents/api/schedule-document-render-kick", () => ({
  scheduleDocumentRenderKick: vi.fn(),
}));

vi.mock("@/_pages/customers/index.server", () => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
  loadCustomerDto: vi.fn(),
}));

vi.mock("@/_pages/collection-lifecycle/index.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-lifecycle/index.server")>();
  return {
    ...actual,
    saveCollectionSignature: vi.fn(),
    finalizeCollection: vi.fn(),
  };
});

import { saveCollectionSignatureAction } from "@/_app/actions/draft-flow.actions";
import { saveCollectionSignature } from "@/_pages/collection-lifecycle/index.server";

const collectionId = "22222222-2222-4222-8222-222222222222";
const acceptanceText = "Declaro que acompanhei a coleta das peças e equipamentos.";

describe("saveCollectionSignatureAction tax id mapping", () => {
  beforeEach(() => {
    vi.mocked(saveCollectionSignature).mockReset();
  });

  it("returns invalid_signer_tax_id without calling the RPC for a checksum failure", async () => {
    const result = await saveCollectionSignatureAction({
      collectionId,
      expectedVersion: 1,
      signerName: "Ana",
      signerTaxId: "11111111111",
      acceptanceText,
      signatureBase64Png: "data:image/png;base64,abc",
    });
    expect(result).toEqual({ ok: false, error: "invalid_signer_tax_id" });
    expect(saveCollectionSignature).not.toHaveBeenCalled();
  });

  it("returns validation_error for other signature fields", async () => {
    const result = await saveCollectionSignatureAction({
      collectionId,
      expectedVersion: 1,
      signerName: "",
      signerTaxId: "52998224725",
      acceptanceText,
      signatureBase64Png: "data:image/png;base64,abc",
    });
    expect(result).toEqual({ ok: false, error: "validation_error" });
    expect(saveCollectionSignature).not.toHaveBeenCalled();
  });
});
