import "server-only";

import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { DocumentRateLimitExceededError, DocumentRateLimitUnavailableError } from "./rate-limit.server";

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

export function deliveryErrorResponse(error: unknown): Readonly<{ code: string; status: number; message: string }> {
  if (error instanceof DocumentDeliveryError) return error;
  if (error instanceof DocumentRateLimitExceededError) return { code: "rate_limit_exceeded", status: 429, message: "Aguarde antes de tentar novamente." };
  if (error instanceof DocumentRateLimitUnavailableError) return { code: "rate_limit_unavailable", status: 503, message: "O serviço está temporariamente indisponível." };
  if (error instanceof AuthenticationRequiredError) return { code: "authentication_required", status: 401, message: "É necessário entrar para continuar." };
  if (error instanceof AdministratorAccessDeniedError) return { code: "forbidden", status: 403, message: "Acesso não autorizado." };
  return { code: "document_delivery_failed", status: 500, message: "Não foi possível concluir a operação documental." };
}
