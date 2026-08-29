import { describe, expect, it } from "vitest";
import { customerInputSchema, customerSearchSchema } from "@/_pages/customers/model/customer";
import { criticalCommandSchema, signatureInputSchema } from "@/_pages/collection-lifecycle/model/contracts";
import { toLifecycleApiError } from "@/_pages/collection-lifecycle/api/lifecycle-errors";
import { isValidCpf, isValidCpfOrCnpj } from "@/shared/lib/cpf";
import { normalizeBrazilianPhone } from "@/shared/lib/phone";
import { validateEvidenceFile } from "@/shared/lib/file-validation";

const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Fase 1A validation contract", () => {
  it("accepts valid CPF/CNPJ and rejects invalid or repeated documents", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpfOrCnpj("04.252.011/0001-10")).toBe(true);
    expect(isValidCpfOrCnpj("111.111.111-11")).toBe(false);
    expect(isValidCpfOrCnpj("04.252.011/0001-11")).toBe(false);
  });

  it("normalizes only valid Brazilian phone numbers", () => {
    expect(normalizeBrazilianPhone("+55 (11) 99876-5432")).toBe("11998765432");
    expect(normalizeBrazilianPhone("(11) 3456-7890")).toBe("1134567890");
    expect(normalizeBrazilianPhone("123")).toBeNull();
    expect(normalizeBrazilianPhone("00000000000")).toBeNull();
  });

  it("normalizes the customer payload and caps search pages at fifty", () => {
    const customer = customerInputSchema.safeParse({
      displayName: "  Cliente sintetico  ",
      taxId: "529.982.247-25",
      phone: "+55 (11) 99876-5432",
    });

    expect(customer.success).toBe(true);
    if (customer.success) {
      expect(customer.data).toEqual({
        displayName: "Cliente sintetico",
        taxId: "52998224725",
        phone: "11998765432",
      });
    }

    expect(customerInputSchema.safeParse({ displayName: "Cliente", taxId: "11111111111", phone: "123" }).success).toBe(false);
    expect(customerSearchSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it("accepts CPF or CNPJ from the signatory and requires a positive version", () => {
    const input = {
      signerName: "Responsavel sintetico",
      acceptanceText: "Aceito os termos desta coleta sintetica.",
      expectedVersion: 1,
    };

    expect(signatureInputSchema.safeParse({ ...input, signerTaxId: "529.982.247-25" }).success).toBe(true);
    expect(signatureInputSchema.safeParse({ ...input, signerTaxId: "04.252.011/0001-10" }).success).toBe(true);
    expect(signatureInputSchema.safeParse({ ...input, expectedVersion: 0, signerTaxId: "529.982.247-25" }).success).toBe(false);
    expect(criticalCommandSchema.safeParse({ expectedVersion: -1 }).success).toBe(false);
    expect(criticalCommandSchema.safeParse({ expectedVersion: 0 }).success).toBe(false);
  });

  it("rejects a spoofed MIME type and hashes a valid evidence image", async () => {
    const spoofed = new File(["not a png"], "evidence.png", { type: "image/png" });
    const valid = new File([validPng], "evidence.png", { type: "image/png" });

    await expect(validateEvidenceFile(spoofed)).resolves.toMatchObject({ valid: false });
    await expect(validateEvidenceFile(valid)).resolves.toMatchObject({
      valid: true,
      extension: "png",
      sha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
    });
  });

  it("exposes stale writes as a stable conflict code rather than a database error", () => {
    expect(toLifecycleApiError({ code: "40001" })).toMatchObject({
      status: 409,
      code: "stale_version",
      actorId: null,
    });
    const tagged = Object.assign(new Error("unexpected_error"), { actorId: "00000000-0000-0000-0000-000000000001" });
    expect(toLifecycleApiError(tagged).actorId).toBe("00000000-0000-0000-0000-000000000001");
    expect(toLifecycleApiError(tagged).message).not.toContain("00000000-0000-0000-0000-000000000001");
  });
});
