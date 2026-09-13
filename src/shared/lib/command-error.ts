import { INVALID_SIGNER_TAX_ID_COPY } from "@/shared/lib/cpf";

export type CommandErrorMapping = Readonly<{
  code: string;
  status: number;
  httpMessage: string;
  actionMessage: string;
}>;

const GENERIC_ACTION_FAILURE =
  "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";
const BUSINESS_RULE_MESSAGE = "A coleta não atende aos requisitos desta operação.";
const UNEXPECTED_HTTP = "Não foi possível concluir a operação.";
const PERMISSION_DENIED = "Você não tem permissão para esta operação.";
const STALE_HTTP = "A coleta foi atualizada por outra operação.";
const VALIDATION_ACTION = "Revise os dados informados e tente novamente.";
const PNG_SIGNATURE_MESSAGE = "A assinatura enviada não é um PNG válido.";
const REOPEN_OS_UNKNOWN =
  "Não foi possível restaurar a ordem de serviço. A coleta permanece cancelada.";
const INVOICE_NOT_READY = "A coleta precisa estar pronta ou em entrega parcial para registrar a NF-e.";
const SERVICE_NOT_IN_SERVICE =
  "A coleta precisa estar aprovada, em reparo, em entrega parcial ou faturada para atualizar o progresso.";
const DELIVERY_NOT_INVOICED =
  "A coleta precisa estar em reparo, pronta, faturada ou em entrega parcial para entregar ao cliente.";

const BUSINESS_RULE: CommandErrorMapping = {
  code: "business_rule_violation",
  status: 422,
  httpMessage: BUSINESS_RULE_MESSAGE,
  actionMessage: BUSINESS_RULE_MESSAGE,
};

const UNEXPECTED: CommandErrorMapping = {
  code: "unexpected_error",
  status: 500,
  httpMessage: UNEXPECTED_HTTP,
  actionMessage: GENERIC_ACTION_FAILURE,
};

type CatalogRow = CommandErrorMapping & { readonly keys: readonly string[] };

function row(
  code: string,
  status: number,
  httpMessage: string,
  actionMessage: string,
  extraKeys: readonly string[] = [],
): CatalogRow {
  return { code, status, httpMessage, actionMessage, keys: [code, ...extraKeys] };
}

function rowSame(
  code: string,
  status: number,
  message: string,
  extraKeys: readonly string[] = [],
): CatalogRow {
  return row(code, status, message, message, extraKeys);
}

const CATALOG: readonly CatalogRow[] = [
  row("authentication_required", 401, "Autenticação obrigatória.", "Sessão expirada. Entre novamente para continuar."),
  rowSame("administrator_access_denied", 403, PERMISSION_DENIED),
  row(
    "stale_version",
    409,
    STALE_HTTP,
    "A coleta foi atualizada por outra operação. Recarregue a página e revise os dados.",
  ),
  row(
    "idempotency_conflict",
    409,
    "A chave de idempotência foi reutilizada com outra requisição.",
    "Esta operação já foi enviada com outros dados. Atualize a página antes de tentar de novo.",
  ),
  rowSame("conflict", 409, "A operação conflita com um registro existente."),
  rowSame("collection_not_draft", 409, "A coleta não está em rascunho."),
  rowSame("service_order_reopen_status_unknown", 409, REOPEN_OS_UNKNOWN),
  rowSame("immutable_record", 409, "O registro documental é imutável.", ["customer_snapshot_immutable"]),
  row(
    "workshop_checkin_not_collected",
    409,
    "A coleta precisa estar no status 'coletada' para iniciar o check-in de oficina.",
    "A coleta precisa estar no status 'coletada' para o check-in de oficina.",
    ["collection_not_collected"],
  ),
  row(
    "budget_not_in_workshop",
    409,
    "A coleta precisa estar no status 'em oficina' para criar o orçamento técnico.",
    "A coleta precisa estar 'em oficina' para registrar o orçamento.",
    ["collection_not_in_workshop"],
  ),
  row(
    "budget_not_in_budget",
    409,
    "A coleta precisa estar no status 'em orçamento' para aprovar/rejeitar.",
    "A coleta precisa estar 'em orçamento' para aprovar ou rejeitar.",
    ["collection_not_in_budget"],
  ),
  rowSame("service_order_not_in_service", 409, SERVICE_NOT_IN_SERVICE, ["collection_not_in_service"]),
  rowSame("invoice_not_ready", 409, INVOICE_NOT_READY, ["collection_not_ready"]),
  rowSame("delivery_not_invoiced", 409, DELIVERY_NOT_INVOICED, ["collection_not_invoiced"]),
  rowSame(
    "collection_not_cancelable_draft",
    409,
    "A coleta em rascunho não pode ser cancelada. Descarte o rascunho.",
  ),
  rowSame("collection_cannot_be_canceled", 409, "A coleta não pode ser cancelada no status atual."),
  rowSame("collection_not_canceled", 409, "A coleta não está cancelada para ser reaberta."),
  rowSame("duplicate_delivery_item", 409, "O mesmo item foi informado mais de uma vez na entrega."),
  rowSame("item_already_delivered", 409, "Um ou mais itens já foram entregues em um termo anterior."),
  rowSame("delivery_intent_required", 409, "A intenção de assinatura não foi confirmada.", [
    "signature_intent_not_committed",
  ]),
  rowSame("upload_intent_not_pending", 409, "A intenção de upload não está pendente."),
  rowSame("upload_intent_expired", 409, "A intenção de upload expirou."),
  rowSame("upload_already_committed", 409, "O upload já foi confirmado."),
  rowSame("signature_object_missing", 409, "O arquivo de assinatura não foi encontrado no armazenamento."),
  rowSame("service_order_not_found", 404, "Ordem de serviço não encontrada para esta coleta."),
  rowSame("service_order_item_not_found", 404, "Item da ordem de serviço não encontrado."),
  rowSame("collection_item_not_found", 404, "Item da coleta não encontrado ou já removido."),
  rowSame("invalid_cursor", 422, "O cursor de paginação é inválido."),
  rowSame("invalid_signer_tax_id", 422, INVALID_SIGNER_TAX_ID_COPY),
  rowSame("item_not_ready", 422, "Somente itens marcados como Pronto podem ser entregues."),
  rowSame(
    "item_not_received",
    422,
    "Este item não chegou na oficina e não pode entrar em orçamento, progresso ou entrega.",
  ),
  rowSame("duplicate_workshop_item", 422, "O mesmo item da coleta foi informado mais de uma vez no check-in."),
  rowSame("workshop_checkin_items_incomplete", 422, "O check-in de oficina deve incluir todos os itens da coleta."),
  rowSame("duplicate_budget_item", 422, "O mesmo item não pode ser informado mais de uma vez no orçamento."),
  rowSame("validation_error", 422, VALIDATION_ACTION),
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados do check-in de oficina inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_workshop_checkin_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados do orçamento técnico inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_budget_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Item do orçamento inválido.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_budget_item"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados de aprovação/rejeição inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_approval_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados de progresso de serviço inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_progress_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Status de progresso do item inválido.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_item_progress_status"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados da NF-e inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_invoice_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados da entrega inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_delivery_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Dados de cancelamento/reabertura inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_cancel_reopen_request"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Metadados de upload inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_upload_metadata"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Metadados de assinatura inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_signature_metadata"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Metadados de evidência inválidos.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_evidence_metadata"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: "Versão esperada inválida.",
    actionMessage: VALIDATION_ACTION,
    keys: ["invalid_expected_version"],
  },
  {
    code: "validation_error",
    status: 422,
    httpMessage: PNG_SIGNATURE_MESSAGE,
    actionMessage: PNG_SIGNATURE_MESSAGE,
    keys: ["invalid_signature_file"],
  },
  rowSame("signature_contract_invalid", 500, "Não foi possível confirmar a assinatura."),
  row("command_contract_invalid", 500, UNEXPECTED_HTTP, GENERIC_ACTION_FAILURE, [
    "lifecycle_command_contract_invalid",
    "operations_command_contract_invalid",
  ]),
];

const LOOKUP: ReadonlyMap<string, CommandErrorMapping> = (() => {
  const entries = new Map<string, CommandErrorMapping>();
  for (const item of CATALOG) {
    const mapping: CommandErrorMapping = {
      code: item.code,
      status: item.status,
      httpMessage: item.httpMessage,
      actionMessage: item.actionMessage,
    };
    for (const key of item.keys) {
      if (!entries.has(key)) {
        entries.set(key, mapping);
      }
    }
  }
  return entries;
})();

type CodedFailure = Readonly<{ code?: unknown; message?: unknown; name?: unknown }>;

function asCoded(error: unknown): CodedFailure | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  return error;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mappingFor(key: string): CommandErrorMapping | null {
  return LOOKUP.get(key) ?? null;
}

function sqlMapped(code: string): CommandErrorMapping | null {
  if (code === "40001") return mappingFor("stale_version");
  if (code === "23505") return mappingFor("conflict");
  if (code === "42501") return mappingFor("administrator_access_denied");
  return null;
}

/**
 * Maps thrown / Postgrest-shaped failures to a stable public code, HTTP status, and copy.
 * Does not leak raw SQL text into `httpMessage` or `actionMessage`.
 */
export function classifyCommandError(error: unknown): CommandErrorMapping {
  const coded = asCoded(error);
  const name = coded ? asString(coded.name) : null;
  if (name === "AuthenticationRequiredError") {
    return mappingFor("authentication_required") ?? UNEXPECTED;
  }
  if (name === "AdministratorAccessDeniedError") {
    return mappingFor("administrator_access_denied") ?? UNEXPECTED;
  }

  const code = coded ? asString(coded.code) : null;
  const message = coded ? asString(coded.message) : null;

  if (code === "P0001" && message !== null) {
    const mapped = mappingFor(message);
    if (mapped) return mapped;
  }

  if (code !== null) {
    const fromSql = sqlMapped(code);
    if (fromSql) return fromSql;
    if (code !== "P0001") {
      const mapped = mappingFor(code);
      if (mapped) return mapped;
    }
  }

  if (message !== null) {
    const mapped = mappingFor(message);
    if (mapped) return mapped;
  }

  if (code === "P0001") return BUSINESS_RULE;
  return UNEXPECTED;
}
