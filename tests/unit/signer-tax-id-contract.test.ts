import { describe, expect, it } from "vitest";
import { draftPatchSchema } from "@/_pages/collection-drafts/model/draft";
import { patchDraftPayloadSchema, saveSignaturePayloadSchema } from "@/_pages/collection-drafts/model/offline-records";
import { signatureInputSchema } from "@/_pages/collection-lifecycle/model/contracts";
import { zodIssueTouchesKey } from "@/shared/lib/cpf";

const acceptanceText = "Declaro que acompanhei a coleta das peças e equipamentos.";

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
        acceptanceText,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid CPF and classifies signerTaxId as the failing field", () => {
    expect(
      saveSignaturePayloadSchema.safeParse({
        signerName: "Ana",
        signerTaxId: "52998224725",
        acceptanceText,
      }).success,
    ).toBe(true);
    const parsed = signatureInputSchema.safeParse({
      signerName: "Ana",
      signerTaxId: "11111111111",
      acceptanceText,
      expectedVersion: 1,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodIssueTouchesKey(parsed.error, "signerTaxId")).toBe(true);
    }
  });

  it("maps tax-id zod failure to invalid_signer_tax_id and leaves other fields as validation_error", () => {
    const taxIdFailure = signatureInputSchema.safeParse({
      signerName: "Ana",
      signerTaxId: "11111111111",
      acceptanceText,
      expectedVersion: 1,
    });
    expect(taxIdFailure.success).toBe(false);
    if (!taxIdFailure.success) {
      expect(zodIssueTouchesKey(taxIdFailure.error, "signerTaxId")).toBe(true);
    }
    const nameFailure = signatureInputSchema.safeParse({
      signerName: "",
      signerTaxId: "52998224725",
      acceptanceText,
      expectedVersion: 1,
    });
    expect(nameFailure.success).toBe(false);
    if (!nameFailure.success) {
      expect(zodIssueTouchesKey(nameFailure.error, "signerTaxId")).toBe(false);
    }
    const locationOnly = draftPatchSchema.safeParse({ expectedVersion: 0, collectionLocation: "Rua" });
    expect(locationOnly.success).toBe(false);
    if (!locationOnly.success) {
      expect(zodIssueTouchesKey(locationOnly.error, "responsibleTaxId")).toBe(false);
    }
  });
});
