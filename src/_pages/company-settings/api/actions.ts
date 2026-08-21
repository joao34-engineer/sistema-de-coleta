"use server";

import { revalidatePath } from "next/cache";
import type { CompanySettingsActionState } from "@/shared/lib/action-result";
import {
  AdministratorAccessDeniedError,
  AuthenticationRequiredError,
  requireAuthenticatedAdministrator,
} from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { validateEvidenceFile, validateLogoFile, type LogoMimeType } from "@/shared/lib/file-validation";
import { createOrReuseLogoAsset } from "./brand-assets.server";
import { toIssuerSettingsRpcInput } from "../model/issuer-settings";
import { companySettingsSchema } from "../model/schema";

const readText = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

function forbiddenState(message: string): CompanySettingsActionState {
  return { status: "error", code: "forbidden", message };
}

const companySettingsColumns = "legal_name,tax_id,phone,street,street_number,address_complement,district,city,state_code,postal_code,receipt_legal_text,signer_name,signer_title,logo_asset_id";

async function publishIssuerProfileIfReady(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: Parameters<typeof toIssuerSettingsRpcInput>[0],
  logoAssetId: string | null,
): Promise<"published" | "incomplete" | "failed"> {
  const issuerInput = toIssuerSettingsRpcInput(input, logoAssetId);
  if (!issuerInput) return "incomplete";

  const { error } = await supabase.rpc("save_company_issuer_settings", issuerInput);
  return error ? "failed" : "published";
}

export async function updateCompanySettingsAction(_previousState: CompanySettingsActionState, formData: FormData): Promise<CompanySettingsActionState> {
  let administrator;
  try {
    administrator = await requireAuthenticatedAdministrator();
  } catch (error: unknown) {
    if (error instanceof AdministratorAccessDeniedError || error instanceof AuthenticationRequiredError) {
      return forbiddenState("Você não tem permissão para alterar estas configurações.");
    }
    throw error;
  }

  const parsed = companySettingsSchema.safeParse({
    legalName: readText(formData, "legalName"),
    taxId: readText(formData, "taxId"),
    phone: readText(formData, "phone"),
    street: readText(formData, "street"),
    streetNumber: readText(formData, "streetNumber"),
    complement: readText(formData, "complement"),
    district: readText(formData, "district"),
    city: readText(formData, "city"),
    stateCode: readText(formData, "stateCode"),
    postalCode: readText(formData, "postalCode"),
    receiptLegalText: readText(formData, "receiptLegalText"),
    signerName: readText(formData, "signerName"),
    signerTitle: readText(formData, "signerTitle"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && fieldErrors[field] === undefined) {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", code: "validation_error", fieldErrors, message: "Revise os campos destacados." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .update({
      legal_name: parsed.data.legalName,
      tax_id: parsed.data.taxId,
      phone: parsed.data.phone,
      street: parsed.data.street,
      street_number: parsed.data.streetNumber,
      address_complement: parsed.data.complement,
      district: parsed.data.district,
      city: parsed.data.city,
      state_code: parsed.data.stateCode,
      postal_code: parsed.data.postalCode,
      receipt_legal_text: parsed.data.receiptLegalText,
      signer_name: parsed.data.signerName,
      signer_title: parsed.data.signerTitle,
      updated_by: administrator.userId,
    })
    .eq("organization_id", administrator.organizationId)
    .select("organization_id")
    .maybeSingle();

  if (error || !data) {
    return { status: "error", code: "unexpected_error", message: "Não foi possível salvar as configurações." };
  }

  const { data: currentSettings, error: currentSettingsError } = await supabase
    .from("organization_settings")
    .select("logo_asset_id")
    .eq("organization_id", administrator.organizationId)
    .maybeSingle();
  if (currentSettingsError || !currentSettings) {
    return { status: "error", code: "unexpected_error", message: "Configurações salvas, mas não foi possível validar o perfil de emissão." };
  }

  const profileStatus = await publishIssuerProfileIfReady(supabase, parsed.data, currentSettings.logo_asset_id ?? null);
  if (profileStatus === "failed") {
    return { status: "error", code: "unexpected_error", message: "Configurações salvas, mas não foi possível atualizar o perfil de emissão." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/empresa");
  return profileStatus === "published"
    ? { status: "success", code: "success", message: "Configurações e perfil de emissão salvos." }
    : { status: "success", code: "success", message: "Configurações salvas. Complete os campos obrigatórios e envie o logo para habilitar a emissão." };
}

export async function uploadCompanyLogoAction(_previousState: CompanySettingsActionState, formData: FormData): Promise<CompanySettingsActionState> {
  let administrator;
  try {
    administrator = await requireAuthenticatedAdministrator();
  } catch (error: unknown) {
    if (error instanceof AdministratorAccessDeniedError || error instanceof AuthenticationRequiredError) {
      return forbiddenState("Você não tem permissão para enviar este arquivo.");
    }
    throw error;
  }

  const logoValue = formData.get("logo");
  const validation = validateLogoFile(logoValue);
  if (!validation.valid) return { status: "error", code: "upload_error", message: validation.message };

  const file = logoValue;
  if (!(file instanceof File)) return { status: "error", code: "upload_error", message: "Arquivo inválido." };

  const evidenceValidation = await validateEvidenceFile(file);
  if (!evidenceValidation.valid) return { status: "error", code: "upload_error", message: evidenceValidation.message };

  const supabase = await createServerSupabaseClient();
  const asset = await createOrReuseLogoAsset({
    organizationId: administrator.organizationId,
    actorUserId: administrator.userId,
    file,
    contentType: file.type as LogoMimeType,
    extension: validation.extension,
    sha256: evidenceValidation.sha256,
  });
  if (!asset.ok) return { status: "error", code: "upload_error", message: "Não foi possível confirmar o logo institucional." };

  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select(companySettingsColumns)
    .eq("organization_id", administrator.organizationId)
    .maybeSingle();
  if (settingsError || !settings) {
    return { status: "error", code: "upload_error", message: "Logo confirmado, mas não foi possível validar o perfil de emissão." };
  }

  const profileStatus = await publishIssuerProfileIfReady(supabase, {
    legalName: settings.legal_name,
    taxId: settings.tax_id,
    phone: settings.phone,
    street: settings.street,
    streetNumber: settings.street_number,
    complement: settings.address_complement,
    district: settings.district,
    city: settings.city,
    stateCode: settings.state_code,
    postalCode: settings.postal_code,
    receiptLegalText: settings.receipt_legal_text,
    signerName: settings.signer_name,
    signerTitle: settings.signer_title,
  }, asset.assetId);
  if (profileStatus === "failed") return { status: "error", code: "upload_error", message: "Logo confirmado, mas não foi possível atualizar o perfil de emissão." };

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/empresa");
  return profileStatus === "published"
    ? { status: "success", code: "success", message: asset.reused ? "Logo reutilizado e perfil de emissão atualizado." : "Logo enviado e perfil de emissão atualizado." }
    : { status: "success", code: "success", message: asset.reused ? "Logo institucional já confirmado." : "Logo institucional confirmado. Complete os demais campos para habilitar a emissão." };
}
