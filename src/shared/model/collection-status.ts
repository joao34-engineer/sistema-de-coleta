/**
 * Status canônicos do ciclo de vida de uma coleta, compartilhados entre slices
 * (listagem, dashboard e operações de oficina).
 */
export const collectionStatuses = [
  "draft",
  "collected",
  "canceled",
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "ready",
  "invoiced",
  "partial_delivery",
  "delivered",
  "rejected",
  "reopened",
] as const;

export type CollectionStatus = (typeof collectionStatuses)[number];

export type CollectionsListFilter = "all" | "collected" | "in_repair" | "ready";

/** Status que representam serviço ativo na oficina (filtro "Em reparo"). */
const repairStatuses: ReadonlySet<CollectionStatus> = new Set<CollectionStatus>([
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "ready",
]);

export function matchesStatusFilter(status: CollectionStatus, filter: CollectionsListFilter): boolean {
  if (filter === "all") return true;
  if (filter === "collected") return status === "collected";
  if (filter === "in_repair") return repairStatuses.has(status);
  return status === "ready";
}

export const collectionStatusLabel: Readonly<Record<CollectionStatus, string>> = {
  draft: "Rascunho",
  collected: "Coletada",
  canceled: "Cancelada",
  in_workshop: "Em oficina",
  in_budget: "Em orçamento",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  in_service: "Em reparo",
  ready: "Pronta",
  invoiced: "Faturada",
  partial_delivery: "Entrega parcial",
  delivered: "Entregue",
  rejected: "Não aprovada",
  reopened: "Reaberta",
};
