"use server";

import { revalidatePath } from "next/cache";
import type { CompanySettingsActionState } from "@/shared/lib/action-result";
import {
  AdministratorAccessDeniedError,
  AuthenticationRequiredError,
  requireAuthenticatedAdministrator,
} from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { validateLogoFile } from "@/shared/lib/file-validation";
import { companySettingsSchema } from "../model/schema";

const readText = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

function forbiddenState(message: string): CompanySettingsActionState {
  return { status: "error", code: "forbidden", message };
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

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/empresa");
  return { status: "success", code: "success", message: "Configurações salvas." };
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

  const validation = validateLogoFile(formData.get("logo"));
  if (!validation.valid) return { status: "error", code: "upload_error", message: validation.message };

  const file = formData.get("logo");
  if (!(file instanceof File)) return { status: "error", code: "upload_error", message: "Arquivo inválido." };

  const supabase = await createServerSupabaseClient();
  const path = `${administrator.organizationId}/company-logo/${crypto.randomUUID()}.${validation.extension}`;
  const { error: uploadError } = await supabase.storage.from("organization-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) return { status: "error", code: "upload_error", message: "Não foi possível enviar o logo." };

  const { data: updatedSettings, error: updateError } = await supabase
    .from("organization_settings")
    .update({ logo_path: path, updated_by: administrator.userId })
    .eq("organization_id", administrator.organizationId)
    .select("organization_id")
    .maybeSingle();

  if (updateError || !updatedSettings) {
    return { status: "error", code: "upload_error", message: "Logo enviado, mas não foi possível vincular o arquivo." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/empresa");
  return { status: "success", code: "success", message: "Logo enviado." };
}
