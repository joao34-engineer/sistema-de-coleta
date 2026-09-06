export const offlineCopy = {
  savedLocally: "Salvo neste aparelho",
  online: "Online",
  syncing: "Sincronizando",
  synced: "Sincronizado",
  failed: "Falha ao sincronizar",
  pendingTitle: "Coletas pendentes de sincronizar",
  pendingEmpty: "Nenhuma coleta pendente neste aparelho.",
  retry: "Tentar de novo",
  retryBusy: "Tentando novamente…",
  completeCollection: "Completar coleta",
  syncComplete: "Sincronização concluída.",
  closePanel: "Fechar",
  showPending: "Ver pendentes",
  resume: "Continuar",
  discard: "Descartar rascunho",
  discardConfirm: "Descartar este rascunho salvo neste aparelho? A guia oficial não é apagada.",
  quotaExceeded: "Não há espaço neste aparelho para guardar o rascunho.",
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
  administrator_access_denied: "Você não tem permissão para esta operação.",
  forbidden: "Você não tem permissão para esta operação.",
  operation_failed: offlineCopy.failed,
  finalize_failed: offlineCopy.onlineFinalizeFailed,
  sync_interrupted: "A sincronização foi interrompida. Tente de novo.",
};

const MACHINE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

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
