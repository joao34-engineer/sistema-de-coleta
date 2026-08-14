import { describe, expect, it } from "vitest";
import { mapCompanySettingsRow } from "@/shared/db/company-settings";
import type { OrganizationSettingsRow } from "@/shared/api/database.types";

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
});
