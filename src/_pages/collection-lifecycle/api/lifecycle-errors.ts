import "server-only";

import { INVALID_SIGNER_TAX_ID_COPY } from "@/shared/lib/cpf";
import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { actorIdFromUnknown } from "@/shared/lib/server-logger";

export type LifecycleApiError = Readonly<{ status: number; code: string; message: string; actorId: string | null }>;

type SupabaseError = Readonly<{ code?: unknown; message?: unknown }>;

function isSupabaseError(value: unknown): value is SupabaseError {
  return typeof value === "object" && value !== null;
}

function mapLifecycleApiError(error: unknown): Omit<LifecycleApiError, "actorId"> {
  if (error instanceof AuthenticationRequiredError) return { status: 401, code: "authentication_required", message: "Autenticação obrigatória." };
  if (error instanceof AdministratorAccessDeniedError) return { status: 403, code: "administrator_access_denied", message: "Você não tem permissão para esta operação." };
  if (isSupabaseError(error) && typeof error.code === "string") {
    if (error.code === "P0001" && error.message === "idempotency_conflict") return { status: 409, code: "idempotency_conflict", message: "A chave de idempotencia foi reutilizada com outra requisicao." };
    if (error.code === "P0001" && error.message === "collection_not_draft") return { status: 409, code: "collection_not_draft", message: "A coleta não está em rascunho." };
    if (error.code === "P0001" && error.message === "invalid_cursor") return { status: 422, code: "invalid_cursor", message: "O cursor de paginação é inválido." };
    if (error.code === "P0001" && error.message === "customer_snapshot_immutable") return { status: 409, code: "immutable_record", message: "O registro documental é imutável." };
    if (error.code === "P0001" && error.message === "invalid_signer_tax_id") return { status: 422, code: "invalid_signer_tax_id", message: INVALID_SIGNER_TAX_ID_COPY };
    if (error.code === "P0001") return { status: 422, code: "business_rule_violation", message: "A coleta não atende aos requisitos desta operação." };
    if (error.code === "40001") return { status: 409, code: "stale_version", message: "A coleta foi atualizada por outra operação." };
    if (error.code === "23505") return { status: 409, code: "conflict", message: "A operação conflita com um registro existente." };
    if (error.code === "42501") return { status: 403, code: "administrator_access_denied", message: "Você não tem permissão para esta operação." };
  }
  if (error instanceof Error && error.message === "invalid_signature_file") return { status: 422, code: "validation_error", message: "A assinatura enviada não é um PNG válido." };
  if (error instanceof Error && error.message === "signature_contract_invalid") return { status: 500, code: "signature_contract_invalid", message: "Não foi possível confirmar a assinatura." };
  return { status: 500, code: "unexpected_error", message: "Não foi possível concluir a operação." };
}

export function toLifecycleApiError(error: unknown): LifecycleApiError {
  return { ...mapLifecycleApiError(error), actorId: actorIdFromUnknown(error) };
}
