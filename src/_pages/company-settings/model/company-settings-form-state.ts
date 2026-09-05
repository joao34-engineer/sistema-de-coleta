import type { CompanySettingsDTO } from "@/shared/api/company-settings";

export type CompanySettingsFormValues = Readonly<{
  legalName: string;
  taxId: string;
  phone: string;
  street: string;
  streetNumber: string;
  complement: string;
  district: string;
  city: string;
  stateCode: string;
  postalCode: string;
  receiptLegalText: string;
  signerName: string;
  signerTitle: string;
}>;

export type CompanySettingsFormField = keyof CompanySettingsFormValues;

export type CompanySettingsFormState = Readonly<{
  values: CompanySettingsFormValues;
  dirty: boolean;
  revision: string;
}>;

const valueOrEmpty = (value: string | null): string => value ?? "";

export function settingsToFormValues(settings: CompanySettingsDTO): CompanySettingsFormValues {
  return {
    legalName: valueOrEmpty(settings.legalName),
    taxId: valueOrEmpty(settings.taxId),
    phone: valueOrEmpty(settings.phone),
    street: valueOrEmpty(settings.address.street),
    streetNumber: valueOrEmpty(settings.address.streetNumber),
    complement: valueOrEmpty(settings.address.complement),
    district: valueOrEmpty(settings.address.district),
    city: valueOrEmpty(settings.address.city),
    stateCode: valueOrEmpty(settings.address.stateCode),
    postalCode: valueOrEmpty(settings.address.postalCode),
    receiptLegalText: valueOrEmpty(settings.receiptLegalText),
    signerName: valueOrEmpty(settings.signerName),
    signerTitle: valueOrEmpty(settings.signerTitle),
  };
}

export function createFormState(settings: CompanySettingsDTO): CompanySettingsFormState {
  return {
    values: settingsToFormValues(settings),
    dirty: false,
    revision: settings.updatedAt,
  };
}

function isNewerRevision(candidate: string, current: string): boolean {
  return candidate.localeCompare(current) > 0;
}

export function applyServerSettings(
  state: CompanySettingsFormState,
  settings: CompanySettingsDTO,
): CompanySettingsFormState {
  if (state.dirty || !isNewerRevision(settings.updatedAt, state.revision)) {
    return state;
  }
  return createFormState(settings);
}

export function applyPersistedSettings(
  state: CompanySettingsFormState,
  settings: CompanySettingsDTO,
): CompanySettingsFormState {
  if (!isNewerRevision(settings.updatedAt, state.revision)) {
    return state;
  }
  return createFormState(settings);
}

export function updateFormField(
  state: CompanySettingsFormState,
  field: CompanySettingsFormField,
  value: string,
): CompanySettingsFormState {
  return {
    ...state,
    dirty: true,
    values: {
      ...state.values,
      [field]: value,
    },
  };
}
