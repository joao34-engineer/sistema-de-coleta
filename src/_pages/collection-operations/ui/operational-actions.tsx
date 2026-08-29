"use client";

import type { Route } from "next";
import type { CollectionStatus } from "@/shared/model/collection-status";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";

export type OperationalAction = Readonly<{
  segment: "checkin" | "orcamento" | "aprovacao" | "progresso" | "nfe" | "entrega" | "reabrir";
  label: string;
}>;

const actionByStatus: Readonly<Partial<Record<CollectionStatus, OperationalAction>>> = {
  collected: { segment: "checkin", label: "Entrada na oficina" },
  in_workshop: { segment: "orcamento", label: "Registrar orçamento" },
  in_budget: { segment: "aprovacao", label: "Aprovar orçamento" },
  awaiting_approval: { segment: "aprovacao", label: "Aprovar orçamento" },
  approved: { segment: "progresso", label: "Atualizar progresso" },
  in_service: { segment: "progresso", label: "Atualizar progresso" },
  ready: { segment: "nfe", label: "Registrar NF-e" },
  invoiced: { segment: "entrega", label: "Entregar ao cliente" },
  partial_delivery: { segment: "entrega", label: "Entregar ao cliente" },
};

const reopenAction: OperationalAction = { segment: "reabrir", label: "Reabrir" };

/** Próxima ação operacional sugerida a partir do status atual da coleta. */
export function nextOperationalAction(status: CollectionStatus): OperationalAction | null {
  if (status === "rejected" || status === "reopened" || status === "canceled") return reopenAction;
  return actionByStatus[status] ?? null;
}

type Props = Readonly<{
  collectionId: string;
  status: CollectionStatus;
}>;

export function OperationalActions({ collectionId, status }: Props) {
  const action = nextOperationalAction(status);
  if (!action) return null;

  return (
    <PendingNavLink
      href={`/coletas/${collectionId}/oficina/${action.segment}` as Route}
      prefetch
      className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--color-primary)] text-[14px] font-semibold text-white shadow-xs transition-all hover:bg-[var(--color-primary-strong)] active:scale-[0.99] active:bg-[var(--color-primary-strong)]"
      contentClassName="flex h-full w-full items-center justify-center rounded-[12px]"
      pendingClassName="opacity-80 ring-2 ring-white/50"
    >
      {action.label}
    </PendingNavLink>
  );
}
