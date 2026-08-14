import "server-only";

import type { OrganizationSettingsRow } from "@/shared/api/database.types";
import type { CompanySettingsDTO } from "@/shared/api/company-settings";
import type { AuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";

const organizationSettingsColumns = "organization_id,legal_name,tax_id,phone,street,street_number,address_complement,district,city,state_code,postal_code,receipt_legal_text,signer_name,signer_title,logo_path,setup_complete,updated_at";

type CompanySettingsDatabaseRow = Pick<OrganizationSettingsRow, "organization_id" | "legal_name" | "tax_id" | "phone" | "street" | "street_number" | "address_complement" | "district" | "city" | "state_code" | "postal_code" | "receipt_legal_text" | "signer_name" | "signer_title" | "logo_path" | "setup_complete" | "updated_at">;

function mapRow(row: CompanySettingsDatabaseRow, displayName: string): CompanySettingsDTO {
  return {
    organizationId: row.organization_id,
    displayName,
    legalName: row.legal_name,
    taxId: row.tax_id,
    phone: row.phone,
    address: {
      street: row.street,
      streetNumber: row.street_number,
      complement: row.address_complement,
      district: row.district,
      city: row.city,
      stateCode: row.state_code,
      postalCode: row.postal_code,
    },
    receiptLegalText: row.receipt_legal_text,
    signerName: row.signer_name,
    signerTitle: row.signer_title,
    logoPath: row.logo_path,
    setupStatus: row.setup_complete ? "complete" : "pending",
    updatedAt: row.updated_at,
  };
}

export async function getCompanySettings(): Promise<CompanySettingsDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  return getCompanySettingsForAdministrator(administrator);
}

export async function getCompanySettingsForAdministrator(administrator: AuthenticatedAdministrator): Promise<CompanySettingsDTO> {
  const supabase = await createServerSupabaseClient();
  const [{ data: settings, error: settingsError }, { data: organization, error: organizationError }] = await Promise.all([
    supabase.from("organization_settings").select(organizationSettingsColumns).eq("organization_id", administrator.organizationId).single(),
    supabase.from("organizations").select("display_name").eq("id", administrator.organizationId).single(),
  ]);

  if (settingsError || organizationError || !settings || !organization) {
    throw new Error("Não foi possível carregar as configurações institucionais.");
  }

  return mapRow(settings, organization.display_name);
}

export function mapCompanySettingsRow(row: OrganizationSettingsRow, displayName: string): CompanySettingsDTO {
  return mapRow(row, displayName);
}
