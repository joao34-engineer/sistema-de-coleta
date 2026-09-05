import type { CompanySettingsDTO, IssuerPublicationStatus } from "@/shared/api/company-settings";

export type LoginActionState = Readonly<{
  status: "idle" | "error";
  code: "validation_error" | "invalid_credentials" | "rate_limit_exceeded" | "temporarily_unavailable" | "unexpected_error";
  fieldErrors?: Readonly<{ email?: string; password?: string }>;
  message?: string;
}>;

export type CompanySettingsActionState = Readonly<{
  status: "idle" | "success" | "error";
  code: "success" | "validation_error" | "forbidden" | "unexpected_error" | "upload_error";
  fieldErrors?: Readonly<Record<string, string>>;
  message?: string;
  persistedSettings?: CompanySettingsDTO;
  publicationStatus?: IssuerPublicationStatus;
}>;

export const initialLoginActionState: LoginActionState = { status: "idle", code: "validation_error" };
export const initialCompanySettingsActionState: CompanySettingsActionState = { status: "idle", code: "validation_error" };
