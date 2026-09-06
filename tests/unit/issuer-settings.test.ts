import { describe, expect, it } from "vitest";
import { issuerRequiredFields, toIssuerSettingsRpcInput } from "@/_pages/company-settings/model/issuer-settings";
import type { CompanySettingsInput } from "@/_pages/company-settings/model/schema";

const logoAssetId = "66666666-6666-4666-8666-666666666666";

const completeInput: CompanySettingsInput = {
  legalName: "MJT Serviços Ltda.",
  taxId: "04252011000110",
  phone: "11999999999",
  street: "Rua MJT",
  streetNumber: "10",
  complement: null,
  district: "Centro",
  city: "São Paulo",
  stateCode: "SP",
  postalCode: "01001000",
  receiptLegalText: "Texto do recibo",
  signerName: "João Marcelo",
  signerTitle: "Administrador",
};

describe("toIssuerSettingsRpcInput", () => {
  it("returns RPC input when all required fields and logo are present", () => {
    const result = toIssuerSettingsRpcInput(completeInput, logoAssetId);
    expect(result).toEqual({
      p_legal_name: completeInput.legalName,
      p_tax_id: completeInput.taxId,
      p_phone: completeInput.phone,
      p_street: completeInput.street,
      p_street_number: completeInput.streetNumber,
      p_district: completeInput.district,
      p_city: completeInput.city,
      p_state_code: completeInput.stateCode,
      p_postal_code: completeInput.postalCode,
      p_receipt_legal_text: completeInput.receiptLegalText,
      p_signer_name: completeInput.signerName,
      p_signer_title: completeInput.signerTitle,
      p_logo_asset_id: logoAssetId,
    });
  });

  it.each(
    issuerRequiredFields.map(({ key, label }) => ({
      key,
      label,
      mutate: (input: CompanySettingsInput): CompanySettingsInput => {
        switch (key) {
          case "legalName":
            return { ...input, legalName: null };
          case "taxId":
            return { ...input, taxId: null };
          case "phone":
            return { ...input, phone: null };
          case "street":
            return { ...input, street: null };
          case "streetNumber":
            return { ...input, streetNumber: null };
          case "district":
            return { ...input, district: null };
          case "city":
            return { ...input, city: null };
          case "stateCode":
            return { ...input, stateCode: null };
          case "postalCode":
            return { ...input, postalCode: null };
          case "receiptLegalText":
            return { ...input, receiptLegalText: null };
          case "signerName":
            return { ...input, signerName: null };
          case "signerTitle":
            return { ...input, signerTitle: null };
          case "logo":
            return input;
          default: {
            const exhaustive: never = key;
            return exhaustive;
          }
        }
      },
      logo: key === "logo" ? null : logoAssetId,
    })),
  )("returns null when $label is missing", ({ mutate, logo }) => {
    expect(toIssuerSettingsRpcInput(mutate(completeInput), logo)).toBeNull();
  });

  it("returns null for invalid CNPJ length", () => {
    expect(toIssuerSettingsRpcInput({ ...completeInput, taxId: "123" }, logoAssetId)).toBeNull();
  });

  it("returns null for phone shorter than 10 characters", () => {
    expect(toIssuerSettingsRpcInput({ ...completeInput, phone: "123456789" }, logoAssetId)).toBeNull();
  });

  it("returns null for invalid UF", () => {
    expect(toIssuerSettingsRpcInput({ ...completeInput, stateCode: "SPP" }, logoAssetId)).toBeNull();
  });

  it("returns null for invalid CEP", () => {
    expect(toIssuerSettingsRpcInput({ ...completeInput, postalCode: "01001" }, logoAssetId)).toBeNull();
  });
});
