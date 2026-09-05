import { describe, expect, it } from "vitest";
import { mapCompanySettingsRow } from "@/shared/db/company-settings";
import type { OrganizationSettingsRow } from "@/shared/api/database.types";
import { toIssuerSettingsRpcInput } from "@/_pages/company-settings/model/issuer-settings";

const row: OrganizationSettingsRow = {
  organization_id: 1,
  legal_name: "MJT Serviços Ltda.",
  tax_id: "04252011000110",
  phone: null,
  street: "Rua MJT",
  street_number: "10",
  address_complement: null,
  district: "Centro",
  city: "São Paulo",
  state_code: "SP",
  postal_code: "01001000",
  receipt_legal_text: "Texto do recibo",
  signer_name: "João Marcelo",
  signer_title: "Administrador",
  logo_path: null,
  logo_asset_id: null,
  setup_complete: false,
  updated_by: null,
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("company settings mapper", () => {
  it("maps database columns to the stable DTO", () => {
    const result = mapCompanySettingsRow(row, "MJT");
    expect(result).toEqual({
      organizationId: 1,
      displayName: "MJT",
      legalName: "MJT Serviços Ltda.",
      taxId: "04252011000110",
      phone: null,
      address: {
        street: "Rua MJT",
        streetNumber: "10",
        complement: null,
        district: "Centro",
        city: "São Paulo",
        stateCode: "SP",
        postalCode: "01001000",
      },
      receiptLegalText: "Texto do recibo",
      signerName: "João Marcelo",
      signerTitle: "Administrador",
      logoPath: null,
      setupStatus: "pending",
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
  });

  it("reports complete only when setup_complete and an active issuer profile exist", () => {
    const completeRow = { ...row, setup_complete: true };
    expect(mapCompanySettingsRow(completeRow, "MJT", false).setupStatus).toBe("pending");
    expect(mapCompanySettingsRow(completeRow, "MJT", true).setupStatus).toBe("complete");
  });
});

describe("issuer profile settings", () => {
  it("does not publish an issuer profile while a required institutional field is absent", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "11999999999", street: "Rua MJT", streetNumber: "10", complement: null,
      district: null, city: "São Paulo", stateCode: "SP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
  });

  it("maps only complete settings to the authenticated issuer RPC contract", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "11999999999", street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toEqual({
      p_legal_name: "MJT Serviços Ltda.", p_tax_id: "04252011000110", p_phone: "11999999999", p_street: "Rua MJT", p_street_number: "10", p_district: "Centro",
      p_city: "São Paulo", p_state_code: "SP", p_postal_code: "01001000", p_receipt_legal_text: "Texto do recibo", p_signer_name: "João Marcelo", p_signer_title: "Administrador",
      p_logo_asset_id: "66666666-6666-4666-8666-666666666666",
    });
  });

  it("rejects phone shorter than ten characters", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "123456789", street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
  });

  it("rejects phone longer than thirty characters", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "1".repeat(31), street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
  });

  it("rejects invalid tax id shape", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "0425201100011", phone: "11999999999", street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
  });

  it("rejects invalid UF or CEP", () => {
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "11999999999", street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SPP", postalCode: "01001000", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
    expect(toIssuerSettingsRpcInput({
      legalName: "MJT Serviços Ltda.", taxId: "04252011000110", phone: "11999999999", street: "Rua MJT", streetNumber: "10", complement: null,
      district: "Centro", city: "São Paulo", stateCode: "SP", postalCode: "0100100", receiptLegalText: "Texto do recibo", signerName: "João Marcelo", signerTitle: "Administrador",
    }, "66666666-6666-4666-8666-666666666666")).toBeNull();
  });
});
