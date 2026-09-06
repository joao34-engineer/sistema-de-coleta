export type SafeActionFailure = Readonly<{ ok: false; error: string }>;

const failureMessages: Readonly<Record<string, string>> = {
  authentication_required: "Sessão expirada. Entre novamente para continuar.",
  administrator_access_denied: "Você não tem permissão para esta operação.",
  stale_version: "A coleta foi atualizada por outra operação. Recarregue a página e revise os dados.",
  idempotency_conflict: "Esta operação já foi enviada com outros dados. Atualize a página antes de tentar de novo.",
  duplicate_workshop_item: "O mesmo item da coleta foi informado mais de uma vez no check-in.",
  workshop_checkin_items_incomplete: "O check-in de oficina deve incluir todos os itens da coleta.",
  workshop_checkin_not_collected: "A coleta precisa estar no status 'coletada' para o check-in de oficina.",
  budget_not_in_workshop: "A coleta precisa estar 'em oficina' para registrar o orçamento.",
  budget_not_in_budget: "A coleta precisa estar 'em orçamento' para aprovar ou rejeitar.",
  service_order_not_in_service: "A coleta precisa estar 'aprovada' ou 'em reparo' para atualizar o progresso.",
  invoice_not_ready: "A coleta precisa estar 'pronta' para registrar a NF-e.",
  delivery_not_invoiced: "A coleta precisa estar 'faturada' ou em entrega parcial para entregar ao cliente.",
  collection_cannot_be_canceled: "A coleta não pode ser cancelada no status atual.",
  collection_not_canceled: "A coleta não está cancelada para ser reaberta.",
  validation_error: "Revise os dados informados e tente novamente.",
};

export function toSafeActionError(error: unknown): SafeActionFailure {
  if (error instanceof Error) {
    const mapped = failureMessages[error.message];
    if (mapped) return { ok: false, error: mapped };
    const supabaseCode = (error as Readonly<{ code?: string }>).code;
    if (supabaseCode && failureMessages[supabaseCode]) {
      return { ok: false, error: failureMessages[supabaseCode] ?? "Não foi possível concluir a operação." };
    }
    if (error.message === "invalid_signature_file") return { ok: false, error: "A assinatura enviada não é um PNG válido." };
  }
  const code = (error as Readonly<{ code?: unknown }>).code;
  if (typeof code === "string") {
    const mapped = failureMessages[code];
    if (mapped) return { ok: false, error: mapped };
    const message = (error as Readonly<{ message?: unknown }>).message;
    if (typeof message === "string" && failureMessages[message]) {
      return { ok: false, error: failureMessages[message] };
    }
    if (code === "P0001") return { ok: false, error: "A coleta não atende aos requisitos desta operação." };
    if (code === "40001") return { ok: false, error: failureMessages["stale_version"] ?? "Recarregue a página e tente novamente." };
  }
  return { ok: false, error: "Não foi possível concluir a operação. Verifique a conexão e tente novamente." };
}
