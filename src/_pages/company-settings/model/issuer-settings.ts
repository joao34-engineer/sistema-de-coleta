import type { CompanySettingsDTO } from "@/shared/api/company-settings";
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

export type IssuerRequiredFieldKey =
  | "legalName"
  | "taxId"
  | "phone"
  | "street"
  | "streetNumber"
  | "district"
  | "city"
  | "stateCode"
  | "postalCode"
  | "receiptLegalText"
  | "signerName"
  | "signerTitle"
  | "logo";

export const issuerRequiredFields: ReadonlyArray<{
  key: IssuerRequiredFieldKey;
  label: string;
}> = [
  { key: "legalName", label: "Razão social" },
  { key: "taxId", label: "CNPJ" },
  { key: "phone", label: "Telefone" },
  { key: "street", label: "Logradouro" },
  { key: "streetNumber", label: "Número" },
  { key: "district", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "stateCode", label: "UF" },
  { key: "postalCode", label: "CEP" },
  { key: "receiptLegalText", label: "Texto jurídico do recibo" },
  { key: "signerName", label: "Nome do signatário" },
  { key: "signerTitle", label: "Cargo do signatário" },
  { key: "logo", label: "Logo institucional" },
];

type IssuerFieldValues = Readonly<{
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  street: string | null;
  streetNumber: string | null;
  district: string | null;
  city: string | null;
  stateCode: string | null;
  postalCode: string | null;
  receiptLegalText: string | null;
  signerName: string | null;
  signerTitle: string | null;
  logoPresent: string | null;
}>;

/**
 * Emissão da guia (PDF) exige perfil imutável com todos os campos abaixo e logo confirmado.
 * Salvamentos parciais continuam permitidos; a RPC de publicação só roda quando tudo estiver válido.
 */
function isIssuerFieldComplete(key: IssuerRequiredFieldKey, values: IssuerFieldValues): boolean {
  switch (key) {
    case "legalName":
      return Boolean(values.legalName);
    case "taxId":
      return Boolean(values.taxId && /^\d{14}$/.test(values.taxId));
    case "phone": {
      const trimmed = values.phone?.trim() ?? "";
      return trimmed.length >= 10 && trimmed.length <= 30;
    }
    case "street":
      return Boolean(values.street);
    case "streetNumber":
      return Boolean(values.streetNumber);
    case "district":
      return Boolean(values.district);
    case "city":
      return Boolean(values.city);
    case "stateCode":
      return Boolean(values.stateCode && /^[A-Z]{2}$/.test(values.stateCode));
    case "postalCode":
      return Boolean(values.postalCode && /^\d{8}$/.test(values.postalCode));
    case "receiptLegalText":
      return Boolean(values.receiptLegalText);
    case "signerName":
      return Boolean(values.signerName);
    case "signerTitle":
      return Boolean(values.signerTitle);
    case "logo":
      return Boolean(values.logoPresent);
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function issuerFieldValuesFromDto(settings: CompanySettingsDTO): IssuerFieldValues {
  return {
    legalName: settings.legalName,
    taxId: settings.taxId,
    phone: settings.phone,
    street: settings.address.street,
    streetNumber: settings.address.streetNumber,
    district: settings.address.district,
    city: settings.address.city,
    stateCode: settings.address.stateCode,
    postalCode: settings.address.postalCode,
    receiptLegalText: settings.receiptLegalText,
    signerName: settings.signerName,
    signerTitle: settings.signerTitle,
    logoPresent: settings.logoPath,
  };
}

export function issuerFieldValuesFromInput(
  settings: CompanySettingsInput,
  logoAssetId: string | null,
): IssuerFieldValues {
  return {
    legalName: settings.legalName,
    taxId: settings.taxId,
    phone: settings.phone,
    street: settings.street,
    streetNumber: settings.streetNumber,
    district: settings.district,
    city: settings.city,
    stateCode: settings.stateCode,
    postalCode: settings.postalCode,
    receiptLegalText: settings.receiptLegalText,
    signerName: settings.signerName,
    signerTitle: settings.signerTitle,
    logoPresent: logoAssetId,
  };
}

export function getMissingIssuerFieldLabels(values: IssuerFieldValues): readonly string[] {
  return issuerRequiredFields
    .filter(({ key }) => !isIssuerFieldComplete(key, values))
    .map(({ label }) => label);
}

export function toIssuerSettingsRpcInput(
  settings: CompanySettingsInput,
  logoAssetId: string | null,
): IssuerSettingsRpcInput | null {
  const values = issuerFieldValuesFromInput(settings, logoAssetId);
  if (getMissingIssuerFieldLabels(values).length > 0) {
    return null;
  }

  return {
    p_legal_name: settings.legalName ?? "",
    p_tax_id: settings.taxId ?? "",
    p_phone: settings.phone ?? "",
    p_street: settings.street ?? "",
    p_street_number: settings.streetNumber ?? "",
    p_district: settings.district ?? "",
    p_city: settings.city ?? "",
    p_state_code: settings.stateCode ?? "",
    p_postal_code: settings.postalCode ?? "",
    p_receipt_legal_text: settings.receiptLegalText ?? "",
    p_signer_name: settings.signerName ?? "",
    p_signer_title: settings.signerTitle ?? "",
    p_logo_asset_id: logoAssetId ?? "",
  };
}
