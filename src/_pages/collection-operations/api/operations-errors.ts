import "server-only";

import { AdministratorAccessDeniedError, AuthenticationRequiredError } from "@/shared/auth/require-admin";
import { INVALID_SIGNER_TAX_ID_COPY } from "@/shared/lib/cpf";
import { actorIdFromUnknown } from "@/shared/lib/server-logger";

export type OperationsApiError = Readonly<{ status: number; code: string; message: string; actorId: string | null }>;

type SupabaseError = Readonly<{ code?: unknown; message?: unknown }>;

function isSupabaseError(value: unknown): value is SupabaseError {
  return typeof value === "object" && value !== null;
}

function mapOperationsApiError(error: unknown): Omit<OperationsApiError, "actorId"> {
  if (error instanceof AuthenticationRequiredError) return { status: 401, code: "authentication_required", message: "Autenticação obrigatória." };
  if (error instanceof AdministratorAccessDeniedError) return { status: 403, code: "administrator_access_denied", message: "Você não tem permissão para esta operação." };
  if (isSupabaseError(error) && typeof error.code === "string") {
    if (error.code === "P0001" && error.message === "idempotency_conflict") return { status: 409, code: "idempotency_conflict", message: "A chave de idempotência foi reutilizada com outra requisição." };
    if (error.code === "P0001" && error.message === "collection_not_collected") return { status: 409, code: "workshop_checkin_not_collected", message: "A coleta precisa estar no status 'coletada' para iniciar o check-in de oficina." };
    if (error.code === "P0001" && error.message === "collection_not_in_workshop") return { status: 409, code: "budget_not_in_workshop", message: "A coleta precisa estar no status 'em oficina' para criar o orçamento técnico." };
    if (error.code === "P0001" && error.message === "collection_not_in_budget") return { status: 409, code: "budget_not_in_budget", message: "A coleta precisa estar no status 'em orçamento' para aprovar/rejeitar." };
    if (error.code === "P0001" && error.message === "collection_not_in_service") return { status: 409, code: "service_order_not_in_service", message: "A coleta precisa estar aprovada, em reparo, em entrega parcial ou faturada para atualizar o progresso." };
    if (error.code === "P0001" && error.message === "collection_not_ready") return { status: 409, code: "invoice_not_ready", message: "A coleta precisa estar pronta ou em entrega parcial para registrar a NF-e." };
    if (error.code === "P0001" && error.message === "item_not_ready") return { status: 422, code: "item_not_ready", message: "Somente itens marcados como Pronto podem ser entregues." };
    if (error.code === "P0001" && error.message === "item_not_received") return { status: 422, code: "item_not_received", message: "Este item não chegou na oficina e não pode entrar em orçamento, progresso ou entrega." };
    if (error.code === "P0001" && error.message === "collection_not_invoiced") return { status: 409, code: "delivery_not_invoiced", message: "A coleta precisa estar em reparo, pronta, faturada ou em entrega parcial para entregar ao cliente." };
    if (error.code === "P0001" && error.message === "collection_not_cancelable_draft") return { status: 409, code: "collection_not_cancelable_draft", message: "A coleta em rascunho não pode ser cancelada. Descarte o rascunho." };
    if (error.code === "P0001" && error.message === "collection_cannot_be_canceled") return { status: 409, code: "collection_cannot_be_canceled", message: "A coleta não pode ser cancelada no status atual." };
    if (error.code === "P0001" && error.message === "collection_not_canceled") return { status: 409, code: "collection_not_canceled", message: "A coleta não está cancelada para ser reaberta." };
    if (error.code === "P0001" && error.message === "service_order_reopen_status_unknown") return { status: 409, code: "service_order_reopen_status_unknown", message: "Não foi possível restaurar a ordem de serviço. A coleta permanece cancelada." };
    if (error.code === "P0001" && error.message === "service_order_not_found") return { status: 404, code: "service_order_not_found", message: "Ordem de serviço não encontrada para esta coleta." };
    if (error.code === "P0001" && error.message === "service_order_item_not_found") return { status: 404, code: "service_order_item_not_found", message: "Item da ordem de serviço não encontrado." };
    if (error.code === "P0001" && error.message === "collection_item_not_found") return { status: 404, code: "collection_item_not_found", message: "Item da coleta não encontrado ou já removido." };
    if (error.code === "P0001" && error.message === "invalid_workshop_checkin_request") return { status: 422, code: "validation_error", message: "Dados do check-in de oficina inválidos." };
    if (error.code === "P0001" && error.message === "duplicate_workshop_item") return { status: 422, code: "duplicate_workshop_item", message: "O mesmo item da coleta foi informado mais de uma vez no check-in." };
    if (error.code === "P0001" && error.message === "workshop_checkin_items_incomplete") return { status: 422, code: "workshop_checkin_items_incomplete", message: "O check-in de oficina deve incluir todos os itens da coleta." };
    if (error.code === "P0001" && error.message === "invalid_budget_request") return { status: 422, code: "validation_error", message: "Dados do orçamento técnico inválidos." };
    if (error.code === "P0001" && error.message === "duplicate_budget_item") return { status: 422, code: "duplicate_budget_item", message: "O mesmo item não pode ser informado mais de uma vez no orçamento." };
    if (error.code === "P0001" && error.message === "invalid_budget_item") return { status: 422, code: "validation_error", message: "Item do orçamento inválido." };
    if (error.code === "P0001" && error.message === "invalid_approval_request") return { status: 422, code: "validation_error", message: "Dados de aprovação/rejeição inválidos." };
    if (error.code === "P0001" && error.message === "invalid_progress_request") return { status: 422, code: "validation_error", message: "Dados de progresso de serviço inválidos." };
    if (error.code === "P0001" && error.message === "invalid_item_progress_status") return { status: 422, code: "validation_error", message: "Status de progresso do item inválido." };
    if (error.code === "P0001" && error.message === "invalid_invoice_request") return { status: 422, code: "validation_error", message: "Dados da NF-e inválidos." };
    if (error.code === "P0001" && error.message === "invalid_delivery_request") return { status: 422, code: "validation_error", message: "Dados da entrega inválidos." };
    if (error.code === "P0001" && error.message === "duplicate_delivery_item") return { status: 409, code: "duplicate_delivery_item", message: "O mesmo item foi informado mais de uma vez na entrega." };
    if (error.code === "P0001" && error.message === "item_already_delivered") return { status: 409, code: "item_already_delivered", message: "Um ou mais itens já foram entregues em um termo anterior." };
    if (error.code === "P0001" && error.message === "invalid_cancel_reopen_request") return { status: 422, code: "validation_error", message: "Dados de cancelamento/reabertura inválidos." };
    if (error.code === "P0001" && error.message === "invalid_upload_metadata") return { status: 422, code: "validation_error", message: "Metadados de upload inválidos." };
    if (error.code === "P0001" && error.message === "invalid_signature_metadata") return { status: 422, code: "validation_error", message: "Metadados de assinatura inválidos." };
    if (error.code === "P0001" && error.message === "invalid_signer_tax_id") return { status: 422, code: "invalid_signer_tax_id", message: INVALID_SIGNER_TAX_ID_COPY };
    if (error.code === "P0001" && error.message === "invalid_evidence_metadata") return { status: 422, code: "validation_error", message: "Metadados de evidência inválidos." };
    if (error.code === "P0001" && error.message === "signature_intent_not_committed") return { status: 409, code: "delivery_intent_required", message: "A intenção de assinatura não foi confirmada." };
    if (error.code === "P0001" && error.message === "upload_intent_not_pending") return { status: 409, code: "upload_intent_not_pending", message: "A intenção de upload não está pendente." };
    if (error.code === "P0001" && error.message === "upload_intent_expired") return { status: 409, code: "upload_intent_expired", message: "A intenção de upload expirou." };
    if (error.code === "P0001" && error.message === "upload_already_committed") return { status: 409, code: "upload_already_committed", message: "O upload já foi confirmado." };
    if (error.code === "P0001" && error.message === "signature_object_missing") return { status: 409, code: "signature_object_missing", message: "O arquivo de assinatura não foi encontrado no armazenamento." };
    if (error.code === "P0001" && error.message === "stale_version") return { status: 409, code: "stale_version", message: "A coleta foi atualizada por outra operação." };
    if (error.code === "P0001" && error.message === "invalid_expected_version") return { status: 422, code: "validation_error", message: "Versão esperada inválida." };
    if (error.code === "P0001") return { status: 422, code: "business_rule_violation", message: "A coleta não atende aos requisitos desta operação." };
    if (error.code === "40001") return { status: 409, code: "stale_version", message: "A coleta foi atualizada por outra operação." };
    if (error.code === "23505") return { status: 409, code: "conflict", message: "A operação conflita com um registro existente." };
    if (error.code === "42501") return { status: 403, code: "administrator_access_denied", message: "Você não tem permissão para esta operação." };
  }
  if (error instanceof Error && error.message === "invalid_signature_file") return { status: 422, code: "validation_error", message: "A assinatura enviada não é um PNG válido." };
  if (error instanceof Error && error.message === "signature_contract_invalid") return { status: 500, code: "signature_contract_invalid", message: "Não foi possível confirmar a assinatura." };
  if (error instanceof Error && error.message === "lifecycle_command_contract_invalid") return { status: 500, code: "command_contract_invalid", message: "Não foi possível concluir a operação." };
  if (error instanceof Error && error.message === "operations_command_contract_invalid") return { status: 500, code: "command_contract_invalid", message: "Não foi possível concluir a operação." };
  return { status: 500, code: "unexpected_error", message: "Não foi possível concluir a operação." };
}

export function toOperationsApiError(error: unknown): OperationsApiError {
  return { ...mapOperationsApiError(error), actorId: actorIdFromUnknown(error) };
}