"use server";

import { revalidatePath } from "next/cache";
import type { CompanySettingsActionState } from "@/shared/lib/action-result";
import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { validateEvidenceFile, validateLogoFile, type LogoMimeType } from "@/shared/lib/file-validation";
import { getRequestId } from "@/shared/lib/server-logger";
import { companySettingsSchema } from "../model/schema";
import { saveCompanySettings, uploadCompanyLogo } from "./commands";

const readText = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

function forbiddenState(message: string): CompanySettingsActionState {
  return { status: "error", code: "forbidden", message };
}

function revalidateCompanySettings(): void {
  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/empresa");
}

function isAccessError(error: unknown): boolean {
  return error instanceof AdministratorAccessDeniedError || error instanceof AuthenticationRequiredError;
}

export async function updateCompanySettingsAction(
  _previousState: CompanySettingsActionState,
  formData: FormData,
): Promise<CompanySettingsActionState> {
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
      if (typeof field === "string" && fieldErrors[field] === undefined) fieldErrors[field] = issue.message;
    }
    return { status: "error", code: "validation_error", fieldErrors, message: "Revise os campos destacados." };
  }

  try {
    const result = await saveCompanySettings(parsed.data, getRequestId());
    if (result.ok || result.settingsPersisted) revalidateCompanySettings();
    if (!result.ok) {
      return {
        status: "error",
        code: "unexpected_error",
        message:
          result.code === "settings_read_failed"
            ? "Configurações salvas, mas não foi possível confirmar os valores persistidos."
            : result.code === "issuer_publish_failed"
              ? "Configurações salvas, mas não foi possível atualizar o perfil de emissão."
              : "Não foi possível salvar as configurações.",
        ...(result.settings === undefined ? {} : { persistedSettings: result.settings }),
        ...(result.publicationStatus === undefined ? {} : { publicationStatus: result.publicationStatus }),
      };
    }
    return result.publicationStatus === "published"
      ? {
          status: "success",
          code: "success",
          message: "Configurações e perfil de emissão salvos.",
          persistedSettings: result.settings,
          publicationStatus: result.publicationStatus,
        }
      : {
          status: "success",
          code: "success",
          message: "Configurações salvas. Complete os campos obrigatórios e envie o logo para habilitar a emissão.",
          persistedSettings: result.settings,
          publicationStatus: result.publicationStatus,
        };
  } catch (error: unknown) {
    if (isAccessError(error)) return forbiddenState("Você não tem permissão para alterar estas configurações.");
    throw error;
  }
}

export async function uploadCompanyLogoAction(
  _previousState: CompanySettingsActionState,
  formData: FormData,
): Promise<CompanySettingsActionState> {
  const logoValue = formData.get("logo");
  const validation = validateLogoFile(logoValue);
  if (!validation.valid) return { status: "error", code: "upload_error", message: validation.message };

  const file = logoValue;
  if (!(file instanceof File)) return { status: "error", code: "upload_error", message: "Arquivo inválido." };

  const evidenceValidation = await validateEvidenceFile(file);
  if (!evidenceValidation.valid) return { status: "error", code: "upload_error", message: evidenceValidation.message };

  try {
    const result = await uploadCompanyLogo({
      file,
      contentType: file.type as LogoMimeType,
      extension: validation.extension,
      sha256: evidenceValidation.sha256,
      requestId: getRequestId(),
    });
    if (result.ok || result.settingsPersisted) revalidateCompanySettings();
    if (!result.ok) {
      return {
        status: "error",
        code: "upload_error",
        message:
          result.code === "issuer_publish_failed"
            ? "Logo confirmado, mas não foi possível atualizar o perfil de emissão."
            : result.settingsPersisted
              ? "Logo confirmado, mas não foi possível validar o perfil de emissão."
              : "Não foi possível confirmar o logo institucional.",
        ...(result.settings === undefined ? {} : { persistedSettings: result.settings }),
        ...(result.publicationStatus === undefined ? {} : { publicationStatus: result.publicationStatus }),
      };
    }
    return result.publicationStatus === "published"
      ? {
          status: "success",
          code: "success",
          message: result.logoReused
            ? "Logo reutilizado e perfil de emissão atualizado."
            : "Logo enviado e perfil de emissão atualizado.",
          persistedSettings: result.settings,
          publicationStatus: result.publicationStatus,
        }
      : {
          status: "success",
          code: "success",
          message: result.logoReused
            ? "Logo institucional já confirmado."
            : "Logo institucional confirmado. Complete os demais campos para habilitar a emissão.",
          persistedSettings: result.settings,
          publicationStatus: result.publicationStatus,
        };
  } catch (error: unknown) {
    if (isAccessError(error)) return forbiddenState("Você não tem permissão para enviar este arquivo.");
    throw error;
  }
}
