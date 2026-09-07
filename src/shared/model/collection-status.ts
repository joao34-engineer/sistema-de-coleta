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
  /** Reservado no CHECK/Zod; nenhuma RPC grava este valor — dwell real é `in_budget`. */
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

export type CollectionsListFilter =
  | "all"
  | "draft"
  | "collected"
  | "in_repair"
  | "ready"
  | "invoiced"
  | "partial_delivery"
  | "canceled";

/** Status que representam serviço ativo na oficina (filtro "Em reparo"). */
export const inRepairStatuses: ReadonlyArray<CollectionStatus> = [
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "rejected",
];

/** Status contados como prontos para entrega no dashboard (não é o chip M06 "Pronta"). */
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

const readyForDeliveryStatusesSet: ReadonlySet<CollectionStatus> = new Set(readyForDeliveryStatuses);

export function isReadyForDelivery(status: CollectionStatus): boolean {
  return readyForDeliveryStatusesSet.has(status);
}

const listFilterStatuses: Readonly<Record<CollectionsListFilter, ReadonlyArray<CollectionStatus>>> = {
  all: collectionStatuses,
  draft: ["draft"],
  collected: ["collected"],
  in_repair: inRepairStatuses,
  ready: ["ready"],
  invoiced: ["invoiced"],
  partial_delivery: ["partial_delivery"],
  canceled: ["canceled"],
};

export function statusesForListFilter(filter: CollectionsListFilter): ReadonlyArray<CollectionStatus> {
  return listFilterStatuses[filter];
}

export function matchesStatusFilter(status: CollectionStatus, filter: CollectionsListFilter): boolean {
  if (filter === "all") return true;
  return statusesForListFilter(filter).includes(status);
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
