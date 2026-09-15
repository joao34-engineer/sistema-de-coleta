import { INVALID_SIGNER_TAX_ID_COPY } from "@/shared/lib/cpf";

export const offlineCopy = {
  savedLocally: "Salvo neste aparelho",
  online: "Online",
  syncing: "Sincronizando",
  synced: "Sincronizado",
  failed: "Falha ao sincronizar",
  pendingTitle: "Coletas pendentes neste aparelho",
  pendingEmpty: "Nenhuma coleta pendente neste aparelho.",
  retry: "Tentar de novo",
  retryBusy: "Tentando novamente…",
  retryStillFailed: "Ainda não foi possível sincronizar.",
  completeCollection: "Completar coleta",
  syncComplete: "Sincronização concluída.",
  closePanel: "Fechar",
  showPending: "Ver pendentes",
  resume: "Continuar",
  discard: "Descartar rascunho",
  discardTitle: "Descartar rascunho?",
  discardCancel: "Cancelar",
  discardAction: "Descartar",
  discardConfirm: "Descartar este rascunho salvo neste aparelho? A guia oficial não é apagada.",
  quotaExceeded: "Não há espaço neste aparelho para guardar o rascunho.",
  stepPersistFailed: "Não foi possível guardar a etapa neste aparelho.",
  searchOffline: "A busca de cliente precisa de internet. Cadastre um novo cliente para continuar.",
  authExpired: "Entre de novo para sincronizar as coletas deste aparelho.",
  queuedFinalize: "Coleta salva neste aparelho. O número oficial será gerado ao sincronizar.",
  onlineFinalizeFailed: "A coleta ficou neste aparelho. A sincronização falhou. Tente de novo.",
  discardConfirmSynced: "Descartar este rascunho neste aparelho e no servidor? A guia oficial, se já existir, não é apagada.",
  discardOfficialKept: "O rascunho local foi removido. A guia oficial não foi apagada.",
  hydrateCustomerFailed: "Não foi possível carregar o cliente.",
  cadastralIncomplete: "Preencha cidade e UF para completar o endereço cadastral, ou deixe a rua vazia.",
  confirmSignatureToIssue: "Confirme a assinatura para emitir a guia.",
  stepCliente: "Cliente",
  stepItens: "Itens",
  stepRevisao: "Revisão",
  stepAssinatura: "Assinatura",
  savedLocallyBody: "Coleta salva neste aparelho.",
  syncingBody: "Enviando o rascunho",
  syncedBody: "Coleta enviada",
  permissionTitle: "Sem permissão",
  validationTitle: "Validação",
  quotaTitle: "Sem espaço",
  sessionTitle: "Sessão expirada",
  pendingBody: "Há rascunhos para sincronizar. Retome, tente de novo ou descarte o rascunho local.",
} as const;

const queueErrorMessages: Readonly<Record<string, string>> = {
  authentication_required: offlineCopy.authExpired,
  stale_version: "A coleta foi atualizada por outra operação. Recarregue e revise os dados.",
  idempotency_conflict: "Esta operação já foi enviada com outros dados. Atualize e tente de novo.",
  invalid_signature_file: "A assinatura enviada não é um PNG válido.",
  collection_incomplete: "Informe o local da coleta antes de continuar.",
  issuer_profile_incomplete: "Os dados do emissor da guia estão incompletos. Ajuste nas configurações.",
  collection_not_draft: offlineCopy.discardOfficialKept,
  immutable_record: offlineCopy.discardOfficialKept,
  invalid_discard_request: "Não foi possível descartar este rascunho.",
  not_found: "Rascunho de coleta não encontrado.",
  signature_contract_invalid: "Não foi possível confirmar a assinatura.",
  signature_upload_failed: "Não foi possível enviar a assinatura. Tente de novo.",
  validation_error: "Revise os dados informados e tente novamente.",
  administrator_access_denied: "Você não tem permissão para esta ação.",
  forbidden: "Você não tem permissão para esta ação.",
  operation_failed: offlineCopy.failed,
  finalize_failed: offlineCopy.onlineFinalizeFailed,
  sync_interrupted: "A sincronização foi interrompida. Tente de novo.",
  collection_requires_item: "Adicione pelo menos um item antes de emitir a guia.",
  collection_requires_signature: offlineCopy.confirmSignatureToIssue,
  customer_not_found: "Cliente não encontrado.",
  duplicate_tax_id: "Já existe um cliente com este CPF ou CNPJ.",
  invalid_signer_tax_id: INVALID_SIGNER_TAX_ID_COPY,
  customer_required: "Selecione ou cadastre um cliente para continuar.",
  collection_item_mismatch: "O item não pertence a esta coleta.",
  signature_upload_conflict:
    "Não foi possível enviar a assinatura porque ela já foi registrada ou está em conflito.",
  sequence_exhausted: "Não foi possível gerar o número oficial da guia. Tente novamente.",
};

const MACHINE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isSignerTaxIdQueueError(code: string | null | undefined): boolean {
  return code === "invalid_signer_tax_id";
}

/**
 * Maps offline queue `lastError` (machine code or legacy Portuguese) to user-facing PT.
 * Never surfaces raw DB text.
 */
export function messageForQueueError(code: string | null | undefined): string {
  if (code === null || code === undefined || code.trim() === "") {
    return offlineCopy.failed;
  }
  const mapped = queueErrorMessages[code];
  if (mapped) {
    return mapped;
  }
  if (!MACHINE_CODE_PATTERN.test(code)) {
    return offlineCopy.failed;
  }
  return offlineCopy.failed;
}

/** Distinct retry outcome when drain leaves the same leftover error. */
export function messageForRetryFailure(code: string | null | undefined): string {
  return `${offlineCopy.retryStillFailed} ${messageForQueueError(code)}`;
}

const VALIDATION_MESSAGES: ReadonlySet<string> = new Set([
  "Informe um CPF ou CNPJ válido.",
  "Preencha Nome/Razão Social, CPF/CNPJ e Telefone.",
  "Informe o local da coleta.",
  "Selecione um cliente existente ou preencha os dados do novo cliente.",
  "Revise os dados informados e tente novamente.",
  "Preencha o nome e a assinatura.",
  "Informe o local da coleta antes de continuar.",
  INVALID_SIGNER_TAX_ID_COPY,
  "CPF inválido, revise e tente novamente.",
  "CNPJ inválido, revise e tente novamente.",
]);

export function titleForOperatorError(message: string, fallback: string): string {
  if (message === offlineCopy.quotaExceeded) {
    return offlineCopy.quotaTitle;
  }
  if (message === offlineCopy.authExpired) {
    return offlineCopy.sessionTitle;
  }
  if (message === "Você não tem permissão para esta ação.") {
    return offlineCopy.permissionTitle;
  }
  if (VALIDATION_MESSAGES.has(message) || message === offlineCopy.cadastralIncomplete) {
    return offlineCopy.validationTitle;
  }
  return fallback;
}
