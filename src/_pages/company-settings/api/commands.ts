import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/api/database.types";
import type { CompanySettingsDTO, IssuerPublicationStatus } from "@/shared/api/company-settings";
import {
  requireAuthenticatedAdministrator,
  type AuthenticatedAdministrator,
} from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { getCompanySettingsForAdministrator } from "@/shared/db/company-settings";
import { logTransactionFailure } from "@/shared/lib/server-logger";
import type { LogoMimeType } from "@/shared/lib/file-validation";
import { toIssuerSettingsRpcInput } from "../model/issuer-settings";
import type { CompanySettingsInput } from "../model/schema";
import { createOrReuseLogoAsset } from "./brand-assets.server";

type IssuerFailureCode =
  | "issuer_settings_invalid"
  | "issuer_logo_invalid"
  | "issuer_settings_incomplete"
  | "issuer_settings_forbidden"
  | "issuer_settings_actor_missing"
  | "organization_not_found"
  | "issuer_profile_not_active"
  | "issuer_publish_failed";

type SettingsFailureCode =
  | "settings_write_failed"
  | "settings_read_failed"
  | "asset_lookup_failed"
  | "asset_upload_failed"
  | "asset_persist_failed"
  | "asset_link_failed"
  | "issuer_publish_failed";

type CompanySettingsCommandResult =
  | Readonly<{
      ok: true;
      settings: CompanySettingsDTO;
      publicationStatus: Exclude<IssuerPublicationStatus, "failed">;
      logoReused?: boolean;
    }>
  | Readonly<{
      ok: false;
      code: SettingsFailureCode;
      settingsPersisted: boolean;
      publicationStatus?: IssuerPublicationStatus;
      settings?: CompanySettingsDTO;
    }>;

type PublishIssuerResult =
  | Readonly<{ status: "published" }>
  | Readonly<{ status: "incomplete" }>
  | Readonly<{ status: "failed"; code: IssuerFailureCode }>;

type UploadCompanyLogoInput = Readonly<{
  file: File;
  contentType: LogoMimeType;
  extension: "png" | "jpg" | "webp";
  sha256: string;
  requestId: string;
}>;

const companySettingsColumns =
  "legal_name,tax_id,phone,street,street_number,address_complement,district,city,state_code,postal_code,receipt_legal_text,signer_name,signer_title,logo_asset_id";

const issuerFailureCodes: ReadonlySet<string> = new Set([
  "issuer_settings_invalid",
  "issuer_logo_invalid",
  "issuer_settings_incomplete",
  "issuer_settings_forbidden",
  "issuer_settings_actor_missing",
  "organization_not_found",
]);

function safeDatabaseCode(code: string | undefined): string | undefined {
  return code !== undefined && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

type KnownIssuerFailureCode = Extract<
  IssuerFailureCode,
  | "issuer_settings_invalid"
  | "issuer_logo_invalid"
  | "issuer_settings_incomplete"
  | "issuer_settings_forbidden"
  | "issuer_settings_actor_missing"
  | "organization_not_found"
>;

function isKnownIssuerFailureCode(message: string): message is KnownIssuerFailureCode {
  return issuerFailureCodes.has(message);
}

function issuerFailureCode(message: string): IssuerFailureCode {
  return isKnownIssuerFailureCode(message) ? message : "issuer_publish_failed";
}

function spreadDatabaseCode(code: string | undefined): { databaseCode?: string } {
  const databaseCode = safeDatabaseCode(code);
  return databaseCode === undefined ? {} : { databaseCode };
}

function failureStatus(code: string): number {
  return code === "issuer_settings_forbidden" ? 403 : 500;
}

function logFailure(input: {
  requestId: string;
  operation: string;
  code: string;
  actorId: string | null;
  databaseCode?: string;
}): void {
  logTransactionFailure({
    requestId: input.requestId,
    operation: input.operation,
    code: input.code,
    actorId: input.actorId,
    status: failureStatus(input.code),
    ...spreadDatabaseCode(input.databaseCode),
  });
}

async function publishIssuerProfileIfReady(
  supabase: SupabaseClient<Database>,
  administrator: AuthenticatedAdministrator,
  input: CompanySettingsInput,
  logoAssetId: string | null,
  requestId: string,
): Promise<PublishIssuerResult> {
  const issuerInput = toIssuerSettingsRpcInput(input, logoAssetId);
  if (!issuerInput) return { status: "incomplete" };

  const { error } = await supabase.rpc("save_company_issuer_settings", issuerInput);
  if (error) {
    const code = issuerFailureCode(error.message);
    logFailure({
      requestId,
      operation: "publish_company_issuer_profile",
      code,
      actorId: administrator.userId,
      ...spreadDatabaseCode(error.code),
    });
    return { status: "failed", code };
  }

  const { data: activeProfile, error: activeProfileError } = await supabase
    .from("document_issuer_profiles")
    .select("id")
    .eq("organization_id", administrator.organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeProfileError || !activeProfile) {
    logFailure({
      requestId,
      operation: "confirm_company_issuer_profile",
      code: "issuer_profile_not_active",
      actorId: administrator.userId,
      ...spreadDatabaseCode(activeProfileError?.code),
    });
    return { status: "failed", code: "issuer_profile_not_active" };
  }

  return { status: "published" };
}

async function readPersistedSettings(
  administrator: AuthenticatedAdministrator,
  requestId: string,
): Promise<CompanySettingsDTO | null> {
  try {
    return await getCompanySettingsForAdministrator(administrator);
  } catch {
    logFailure({
      requestId,
      operation: "read_company_settings_after_write",
      code: "settings_read_failed",
      actorId: administrator.userId,
    });
    return null;
  }
}

export async function saveCompanySettings(
  input: CompanySettingsInput,
  requestId: string,
): Promise<CompanySettingsCommandResult> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .update({
      legal_name: input.legalName,
      tax_id: input.taxId,
      phone: input.phone,
      street: input.street,
      street_number: input.streetNumber,
      address_complement: input.complement,
      district: input.district,
      city: input.city,
      state_code: input.stateCode,
      postal_code: input.postalCode,
      receipt_legal_text: input.receiptLegalText,
      signer_name: input.signerName,
      signer_title: input.signerTitle,
      updated_by: administrator.userId,
    })
    .eq("organization_id", administrator.organizationId)
    .select("logo_asset_id")
    .maybeSingle();

  if (error || !data) {
    logFailure({
      requestId,
      operation: "save_company_settings",
      code: "settings_write_failed",
      actorId: administrator.userId,
      ...spreadDatabaseCode(error?.code),
    });
    return { ok: false, code: "settings_write_failed", settingsPersisted: false };
  }

  const publication = await publishIssuerProfileIfReady(
    supabase,
    administrator,
    input,
    data.logo_asset_id ?? null,
    requestId,
  );
  const settings = await readPersistedSettings(administrator, requestId);
  if (!settings) {
    return {
      ok: false,
      code: "settings_read_failed",
      settingsPersisted: true,
      publicationStatus: publication.status,
    };
  }
  if (publication.status === "failed") {
    return {
      ok: false,
      code: "issuer_publish_failed",
      settingsPersisted: true,
      publicationStatus: "failed",
      settings,
    };
  }
  return { ok: true, settings, publicationStatus: publication.status };
}

export async function uploadCompanyLogo(input: UploadCompanyLogoInput): Promise<CompanySettingsCommandResult> {
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createServerSupabaseClient();
  const asset = await createOrReuseLogoAsset({
    storageClient: supabase,
    organizationId: administrator.organizationId,
    actorUserId: administrator.userId,
    file: input.file,
    contentType: input.contentType,
    extension: input.extension,
    sha256: input.sha256,
  });
  if (!asset.ok) {
    logFailure({
      requestId: input.requestId,
      operation: "save_company_logo",
      code: asset.code,
      actorId: administrator.userId,
    });
    return { ok: false, code: asset.code, settingsPersisted: false };
  }

  const { data: row, error } = await supabase
    .from("organization_settings")
    .select(companySettingsColumns)
    .eq("organization_id", administrator.organizationId)
    .maybeSingle();
  if (error || !row) {
    logFailure({
      requestId: input.requestId,
      operation: "read_company_settings_after_logo",
      code: "settings_read_failed",
      actorId: administrator.userId,
      ...spreadDatabaseCode(error?.code),
    });
    return { ok: false, code: "settings_read_failed", settingsPersisted: true };
  }

  const publication = await publishIssuerProfileIfReady(
    supabase,
    administrator,
    {
      legalName: row.legal_name,
      taxId: row.tax_id,
      phone: row.phone,
      street: row.street,
      streetNumber: row.street_number,
      complement: row.address_complement,
      district: row.district,
      city: row.city,
      stateCode: row.state_code,
      postalCode: row.postal_code,
      receiptLegalText: row.receipt_legal_text,
      signerName: row.signer_name,
      signerTitle: row.signer_title,
    },
    asset.assetId,
    input.requestId,
  );
  const settings = await readPersistedSettings(administrator, input.requestId);
  if (!settings) {
    return {
      ok: false,
      code: "settings_read_failed",
      settingsPersisted: true,
      publicationStatus: publication.status,
    };
  }
  if (publication.status === "failed") {
    return {
      ok: false,
      code: "issuer_publish_failed",
      settingsPersisted: true,
      publicationStatus: "failed",
      settings,
    };
  }
  return {
    ok: true,
    settings,
    publicationStatus: publication.status,
    logoReused: asset.reused,
  };
}
