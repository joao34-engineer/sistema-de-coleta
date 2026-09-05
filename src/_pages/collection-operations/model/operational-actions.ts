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
}>;

const primaryByStatus: Readonly<Partial<Record<CollectionStatus, OperationalAction>>> = {
  collected: { segment: "checkin", label: "Entrada na oficina" },
  in_workshop: { segment: "orcamento", label: "Registrar orçamento" },
  in_budget: { segment: "aprovacao", label: "Aprovar orçamento" },
  awaiting_approval: { segment: "aprovacao", label: "Aprovar orçamento" },
  approved: { segment: "progresso", label: "Atualizar progresso" },
  in_service: { segment: "progresso", label: "Atualizar progresso" },
  ready: { segment: "nfe", label: "Registrar NF-e" },
  invoiced: { segment: "entrega", label: "Entregar ao cliente" },
  partial_delivery: { segment: "entrega", label: "Entregar ao cliente" },
  canceled: { segment: "reabrir", label: "Reabrir" },
  rejected: { segment: "orcamento", label: "Novo orçamento" },
};

const cancelAction: OperationalAction = { segment: "cancelar", label: "Cancelar" };

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
 * Matriz B14: CTAs do hub de oficina.
 * `reopened` é inalcançável (RPC nunca grava esse status) — retorna null/null.
 */
export function operationalActionsForStatus(status: CollectionStatus): OperationalActionPair {
  if (status === "reopened" || status === "delivered" || status === "draft") {
    return { primary: null, secondary: null };
  }

  return {
    primary: primaryByStatus[status] ?? null,
    secondary: statusesWithCancel.has(status) ? cancelAction : null,
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
