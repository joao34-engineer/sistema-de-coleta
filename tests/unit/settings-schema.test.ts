import { describe, expect, it } from "vitest";
import { companySettingsSchema } from "@/_pages/company-settings/model/schema";

describe("company settings schema", () => {
  it("normalizes blank values and address fields", () => {
    const result = companySettingsSchema.safeParse({ legalName: " ", taxId: "04.252.011/0001-10", phone: "", street: "Rua MJT", streetNumber: "1", complement: "", district: "Centro", city: "São Paulo", stateCode: "sp", postalCode: "01001-000", receiptLegalText: "Recibo", signerName: "João", signerTitle: "Diretor" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.taxId).toBe("04252011000110");
  });
  it("rejects invalid state and CNPJ", () => {
    const result = companySettingsSchema.safeParse({ legalName: "MJT", taxId: "1", phone: "", street: "", streetNumber: "", complement: "", district: "", city: "", stateCode: "S", postalCode: "", receiptLegalText: "", signerName: "", signerTitle: "" });
    expect(result.success).toBe(false);
  });
});
