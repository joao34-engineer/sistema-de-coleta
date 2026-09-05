import type { CompanySettingsInput } from "./schema";

export type IssuerSettingsRpcInput = Readonly<{
  p_legal_name: string;
  p_tax_id: string;
  p_phone: string;
  p_street: string;
  p_street_number: string;
  p_district: string;
  p_city: string;
  p_state_code: string;
  p_postal_code: string;
  p_receipt_legal_text: string;
  p_signer_name: string;
  p_signer_title: string;
  p_logo_asset_id: string;
}>;

/**
 * A configuração institucional pode permanecer incompleta durante a Fase 1A.
 * Só chamamos a RPC que cria um perfil imutável quando todos os campos de
 * emissão (incluindo bairro e logo confirmado) estiverem presentes.
 */
export function toIssuerSettingsRpcInput(settings: CompanySettingsInput, logoAssetId: string | null): IssuerSettingsRpcInput | null {
  if (
    !settings.legalName ||
    !settings.taxId || !/^\d{14}$/.test(settings.taxId) ||
    !settings.phone || settings.phone.trim().length < 10 || settings.phone.trim().length > 30 ||
    !settings.street ||
    !settings.streetNumber ||
    !settings.district ||
    !settings.city ||
    !settings.stateCode || !/^[A-Z]{2}$/.test(settings.stateCode) ||
    !settings.postalCode || !/^\d{8}$/.test(settings.postalCode) ||
    !settings.receiptLegalText ||
    !settings.signerName ||
    !settings.signerTitle ||
    !logoAssetId
  ) {
    return null;
  }

  return {
    p_legal_name: settings.legalName,
    p_tax_id: settings.taxId,
    p_phone: settings.phone,
    p_street: settings.street,
    p_street_number: settings.streetNumber,
    p_district: settings.district,
    p_city: settings.city,
    p_state_code: settings.stateCode,
    p_postal_code: settings.postalCode,
    p_receipt_legal_text: settings.receiptLegalText,
    p_signer_name: settings.signerName,
    p_signer_title: settings.signerTitle,
    p_logo_asset_id: logoAssetId,
  };
}
