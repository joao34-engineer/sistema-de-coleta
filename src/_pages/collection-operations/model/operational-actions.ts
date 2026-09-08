import type { CollectionStatus } from "@/shared/model/collection-status";

export type OperationalSegment =
  | "checkin"
  | "orcamento"
  | "aprovacao"
  | "progresso"
  | "nfe"
  | "entrega"
  | "reabrir"
  | "cancelar";

export type OperationalAction = Readonly<{
  segment: OperationalSegment;
  label: string;
}>;

export type OperationalActionPair = Readonly<{
  primary: OperationalAction | null;
  secondary: OperationalAction | null;
  extra: OperationalAction | null;
}>;

/** Facts the CTA matrix needs beyond collection status. Absent facts must not widen the matrix. */
export type OperationalItemFacts = Readonly<{
  hasUndeliveredReadyItem: boolean;
  hasInRepairItem: boolean;
}>;

export type OperationalBudgetLine = Readonly<{
  collectionItemId: string;
  status: "em_reparo" | "pronto" | null;
}>;

const primaryByStatus: Readonly<Partial<Record<CollectionStatus, OperationalAction>>> = {
  collected: { segment: "checkin", label: "Entrada na oficina" },
  in_workshop: { segment: "orcamento", label: "Registrar orçamento" },
  in_budget: { segment: "aprovacao", label: "Aprovar orçamento" },
  awaiting_approval: { segment: "aprovacao", label: "Aprovar orçamento" },
  approved: { segment: "progresso", label: "Atualizar progresso" },
  in_service: { segment: "progresso", label: "Atualizar progresso" },
  ready: { segment: "entrega", label: "Entregar ao cliente" },
  invoiced: { segment: "entrega", label: "Entregar ao cliente" },
  partial_delivery: { segment: "entrega", label: "Entregar ao cliente" },
  canceled: { segment: "reabrir", label: "Reabrir" },
  rejected: { segment: "orcamento", label: "Novo orçamento" },
};

const cancelAction: OperationalAction = { segment: "cancelar", label: "Cancelar" };

const deliverReadyItemsAction: OperationalAction = {
  segment: "entrega",
  label: "Entregar itens prontos",
};

const updateProgressAction: OperationalAction = {
  segment: "progresso",
  label: "Atualizar progresso",
};

const statusesWithCancel: ReadonlySet<CollectionStatus> = new Set<CollectionStatus>([
  "rejected",
  "collected",
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "ready",
  "invoiced",
  "partial_delivery",
]);

/**
 * Derives CTA item facts from collection lines + service-order progress.
 * A missing service-order line is not deliverable and not in repair.
 */
export function operationalItemFactsFrom(
  collectionItemIds: ReadonlyArray<string>,
  budgetItems: ReadonlyArray<OperationalBudgetLine>,
  alreadyDeliveredItemIds: ReadonlyArray<string> = [],
): OperationalItemFacts {
  let hasUndeliveredReadyItem = false;
  let hasInRepairItem = false;

  for (const itemId of collectionItemIds) {
    const budgetItem = budgetItems.find((item) => item.collectionItemId === itemId);
    if (budgetItem === undefined) {
      continue;
    }
    if (budgetItem.status === "pronto" && !alreadyDeliveredItemIds.includes(itemId)) {
      hasUndeliveredReadyItem = true;
    }
    if (budgetItem.status === "em_reparo" && !alreadyDeliveredItemIds.includes(itemId)) {
      hasInRepairItem = true;
    }
  }

  return { hasUndeliveredReadyItem, hasInRepairItem };
}

function usesPartialDeliveryMatrix(status: CollectionStatus): boolean {
  return status === "partial_delivery" || status === "invoiced";
}

function primaryActionForStatus(
  status: CollectionStatus,
  itemFacts: OperationalItemFacts | undefined,
): OperationalAction | null {
  if (usesPartialDeliveryMatrix(status) && itemFacts !== undefined) {
    if (itemFacts.hasUndeliveredReadyItem) {
      return primaryByStatus.partial_delivery ?? null;
    }
    if (itemFacts.hasInRepairItem) {
      return updateProgressAction;
    }
    return null;
  }
  return primaryByStatus[status] ?? null;
}

function extraActionForStatus(
  status: CollectionStatus,
  itemFacts: OperationalItemFacts | undefined,
): OperationalAction | null {
  if (itemFacts === undefined) return null;
  if (status === "in_service" && itemFacts.hasUndeliveredReadyItem) {
    return deliverReadyItemsAction;
  }
  if (
    usesPartialDeliveryMatrix(status) &&
    itemFacts.hasUndeliveredReadyItem &&
    itemFacts.hasInRepairItem
  ) {
    return updateProgressAction;
  }
  return null;
}

/**
 * Matriz B14: CTAs do hub de oficina.
 * `reopened` é inalcançável (RPC nunca grava esse status) — retorna null/null.
 * Extra actions depend on item facts; omitting facts preserves today's matrix.
 */
export function operationalActionsForStatus(
  status: CollectionStatus,
  itemFacts: OperationalItemFacts | undefined = undefined,
): OperationalActionPair {
  if (status === "reopened" || status === "delivered" || status === "draft") {
    return { primary: null, secondary: null, extra: null };
  }

  return {
    primary: primaryActionForStatus(status, itemFacts),
    secondary: statusesWithCancel.has(status) ? cancelAction : null,
    extra: extraActionForStatus(status, itemFacts),
  };
}

/** Ação primária sugerida a partir do status atual da coleta. */
export function nextOperationalAction(status: CollectionStatus): OperationalAction | null {
  return operationalActionsForStatus(status).primary;
}

/** Ação secundária (Cancelar) quando o status permite. */
export function secondaryOperationalAction(status: CollectionStatus): OperationalAction | null {
  return operationalActionsForStatus(status).secondary;
}

/** NF-e continua disponível em Pronto e em entrega parcial; não bloqueia a entrega (L2). */
export function optionalInvoiceAction(status: CollectionStatus): OperationalAction | null {
  if (status !== "ready" && status !== "partial_delivery") return null;
  return { segment: "nfe", label: "Registrar NF-e (opcional)" };
}

/** Inverso da matriz de CTAs do hub: a URL de oficina só é válida se o hub ofereceria esse segmento. */
export function isWorkshopSegmentAllowed(
  status: CollectionStatus,
  segment: OperationalSegment,
  itemFacts: OperationalItemFacts | undefined = undefined,
): boolean {
  const { primary, secondary, extra } = operationalActionsForStatus(status, itemFacts);
  if (primary?.segment === segment || secondary?.segment === segment || extra?.segment === segment) {
    return true;
  }
  return optionalInvoiceAction(status)?.segment === segment;
}
