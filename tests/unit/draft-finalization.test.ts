import { describe, expect, it } from "vitest";
import { signatureInputSchema } from "@/_pages/collection-lifecycle/model/contracts";
import { draftPatchSchema, itemPatchCommandSchema } from "@/_pages/collection-drafts/model/draft";
import { validatePngSignature } from "@/_pages/collection-lifecycle/api/commands";

const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Fase 3A — Draft finalization and edit contracts", () => {
  it("validates signature input with CPF/CNPJ and positive expected version", () => {
    const validCpfInput = {
      signerName: "Carlos Eduardo Silva",
      signerTaxId: "529.982.247-25",
      acceptanceText: "Declaro que acompanhei a coleta das peças.",
      expectedVersion: 1,
    };

    const validCnpjInput = {
      signerName: "Empresa MJT LTDA",
      signerTaxId: "04.252.011/0001-10",
      acceptanceText: "Declaro que acompanhei a coleta das peças.",
      expectedVersion: 2,
    };

    expect(signatureInputSchema.safeParse(validCpfInput).success).toBe(true);
    expect(signatureInputSchema.safeParse(validCnpjInput).success).toBe(true);
    expect(signatureInputSchema.safeParse({ ...validCpfInput, expectedVersion: 0 }).success).toBe(false);
    expect(signatureInputSchema.safeParse({ ...validCpfInput, signerTaxId: "invalid" }).success).toBe(false);
  });

  it("validates item patch schema for quantity, condition, and notes updates", () => {
    const validPatch = {
      expectedVersion: 3,
      description: "Motor Elétrico WEG 50CV Editado",
      quantity: 2,
      condition: "Com Avaria",
      notes: "Eixo com folga severa",
    };

    const result = itemPatchCommandSchema.safeParse(validPatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(2);
      expect(result.data.condition).toBe("Com Avaria");
    }

    expect(itemPatchCommandSchema.safeParse({ ...validPatch, quantity: 0 }).success).toBe(false);
    expect(itemPatchCommandSchema.safeParse({ ...validPatch, expectedVersion: -1 }).success).toBe(false);
  });

  it("validates draft patch schema for responsible name and document", () => {
    const validResponsiblePatch = {
      expectedVersion: 1,
      responsibleName: "Marcos Souza",
      responsibleTaxId: "52998224725",
    };

    const result = draftPatchSchema.safeParse(validResponsiblePatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responsibleName).toBe("Marcos Souza");
    }

    expect(draftPatchSchema.safeParse({ expectedVersion: 1, responsibleName: "" }).success).toBe(false);
  });

  it("validates signature PNG file format and magic bytes", () => {
    const validPngFile = new File([validPngHeader], "signature.png", { type: "image/png" });
    const invalidJpgFile = new File([new Uint8Array([0xff, 0xd8, 0xff])], "signature.jpg", { type: "image/jpeg" });

    expect(validatePngSignature(validPngFile)).toBe(true);
    expect(validatePngSignature(invalidJpgFile)).toBe(false);
  });
});
