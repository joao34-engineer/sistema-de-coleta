import { describe, expect, it } from "vitest";
import { canFinalizeCollection } from "@/_pages/collection-drafts/model/can-finalize-collection";

describe("canFinalizeCollection", () => {
  it("stays closed until signature, identity and location are all present", () => {
    expect(
      canFinalizeCollection({
        collectionLocation: "Rua da Oficina",
        signatureDataUrl: null,
        signerName: "Ana",
        signerTaxId: "52998224725",
      }),
    ).toBe(false);
    expect(
      canFinalizeCollection({
        collectionLocation: "Rua da Oficina",
        signatureDataUrl: "data:image/png;base64,abc",
        signerName: "Ana",
        signerTaxId: "52998224725",
      }),
    ).toBe(true);
  });

  it("stays closed for 11 or 14 digits that fail the checksum", () => {
    const base = {
      collectionLocation: "Rua da Oficina",
      signatureDataUrl: "data:image/png;base64,abc",
      signerName: "Ana",
    };
    expect(canFinalizeCollection({ ...base, signerTaxId: "11111111111" })).toBe(false);
    expect(canFinalizeCollection({ ...base, signerTaxId: "12345678901" })).toBe(false);
    expect(canFinalizeCollection({ ...base, signerTaxId: "04252011000111" })).toBe(false);
  });
});
