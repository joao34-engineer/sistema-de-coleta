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
export const inRepairStatuses: ReadonlyArray<CollectionStatus> = [
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "rejected",
];

/** Status que representam coletas prontas para entrega (filtro "Prontas"). */
export const readyForDeliveryStatuses: ReadonlyArray<CollectionStatus> = [
  "ready",
  "invoiced",
  "partial_delivery",
];

/** Status contados como "em andamento" no dashboard (exclui draft, cancelada e entregue). */
export const inProgressStatuses: ReadonlyArray<CollectionStatus> = [
  "collected",
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "rejected",
  "ready",
  "invoiced",
  "partial_delivery",
  "reopened",
];

const inRepairStatusesSet: ReadonlySet<CollectionStatus> = new Set(inRepairStatuses);
const readyForDeliveryStatusesSet: ReadonlySet<CollectionStatus> = new Set(readyForDeliveryStatuses);

export function isReadyForDelivery(status: CollectionStatus): boolean {
  return readyForDeliveryStatusesSet.has(status);
}

export function statusesForListFilter(filter: CollectionsListFilter): ReadonlyArray<CollectionStatus> {
  if (filter === "all") return collectionStatuses;
  if (filter === "collected") return ["collected"];
  if (filter === "in_repair") return inRepairStatuses;
  return readyForDeliveryStatuses;
}

export function matchesStatusFilter(status: CollectionStatus, filter: CollectionsListFilter): boolean {
  if (filter === "all") return true;
  if (filter === "collected") return status === "collected";
  if (filter === "in_repair") return inRepairStatusesSet.has(status);
  return isReadyForDelivery(status);
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
