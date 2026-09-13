import type { CompanySettingsDTO, IssuerPublicationStatus } from "@/shared/api/company-settings";

export type CompanySettingsActionState = Readonly<{
  status: "idle" | "success" | "error";
  code: "success" | "validation_error" | "forbidden" | "unexpected_error" | "upload_error";
  fieldErrors?: Readonly<Record<string, string>>;
  message?: string;
  persistedSettings?: CompanySettingsDTO;
  publicationStatus?: IssuerPublicationStatus;
}>;

export const initialCompanySettingsActionState: CompanySettingsActionState = { status: "idle", code: "validation_error" };
