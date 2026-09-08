import { describe, expect, it } from "vitest";
import { draftPatchSchema } from "@/_pages/collection-drafts/model/draft";
import { patchDraftPayloadSchema, saveSignaturePayloadSchema } from "@/_pages/collection-drafts/model/offline-records";
import { signatureInputSchema } from "@/_pages/collection-lifecycle/model/contracts";

describe("signer tax id checksum contracts", () => {
  it("rejects length-only invalid CPF on draft patch and signature payloads", () => {
    expect(
      draftPatchSchema.safeParse({ expectedVersion: 1, responsibleTaxId: "11111111111" }).success,
    ).toBe(false);
    expect(patchDraftPayloadSchema.safeParse({ responsibleTaxId: "12345678901" }).success).toBe(false);
    expect(
      saveSignaturePayloadSchema.safeParse({
        signerName: "Ana",
        signerTaxId: "11111111111",
        acceptanceText: "Declaro que acompanhei a coleta das peças e equipamentos.",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid CPF and classifies signerTaxId as the failing field", () => {
    expect(
      saveSignaturePayloadSchema.safeParse({
        signerName: "Ana",
        signerTaxId: "52998224725",
        acceptanceText: "Declaro que acompanhei a coleta das peças e equipamentos.",
      }).success,
    ).toBe(true);
    const parsed = signatureInputSchema.safeParse({
      signerName: "Ana",
      signerTaxId: "11111111111",
      acceptanceText: "Declaro que acompanhei a coleta das peças e equipamentos.",
      expectedVersion: 1,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes("signerTaxId"))).toBe(true);
    }
  });
});
