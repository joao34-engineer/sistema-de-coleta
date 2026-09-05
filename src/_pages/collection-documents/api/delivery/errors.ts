import "server-only";

import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { DocumentRateLimitExceededError, DocumentRateLimitUnavailableError } from "@/shared/lib/rate-limit.server";

export class DocumentDeliveryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "DocumentDeliveryError";
    this.code = code;
    this.status = status;
  }
}

type SupabaseError = Readonly<{ code?: unknown; message?: unknown }>;

function isSupabaseError(value: unknown): value is SupabaseError {
  return typeof value === "object" && value !== null;
}

function mapDocumentRetrySupabaseError(error: SupabaseError): Readonly<{ code: string; status: number; message: string }> | null {
  if (typeof error.code !== "string") return null;
  if (error.code === "P0002" && error.message === "document_not_found") {
    return { code: "not_found", status: 404, message: "Documento não encontrado." };
  }
  if (error.code === "P0002" && error.message === "document_job_not_found") {
    return { code: "document_job_not_found", status: 404, message: "Trabalho de renderização não encontrado." };
  }
  if (error.code === "P0001" && error.message === "document_job_in_progress") {
    return { code: "document_job_in_progress", status: 422, message: "A geração do PDF ainda está em andamento." };
  }
  if (error.code === "42501") {
    return { code: "forbidden", status: 403, message: "Acesso não autorizado." };
  }
  return null;
}

export function deliveryErrorResponse(error: unknown): Readonly<{ code: string; status: number; message: string }> {
  if (error instanceof DocumentDeliveryError) return error;
  if (error instanceof DocumentRateLimitExceededError) return { code: "rate_limit_exceeded", status: 429, message: "Aguarde antes de tentar novamente." };
  if (error instanceof DocumentRateLimitUnavailableError) return { code: "rate_limit_unavailable", status: 503, message: "O serviço está temporariamente indisponível." };
  if (error instanceof AuthenticationRequiredError) return { code: "authentication_required", status: 401, message: "É necessário entrar para continuar." };
  if (error instanceof AdministratorAccessDeniedError) return { code: "forbidden", status: 403, message: "Acesso não autorizado." };
  if (isSupabaseError(error)) {
    const mapped = mapDocumentRetrySupabaseError(error);
    if (mapped) return mapped;
  }
  return { code: "document_delivery_failed", status: 500, message: "Não foi possível concluir a operação documental." };
}
