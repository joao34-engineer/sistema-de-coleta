/**
 * View models serializáveis consumidos por Client Components do hub de detalhe.
 * Espelham os schemas de leitura em api/queries.ts (server-only) na fronteira cliente.
 */
import type { CollectionStatus } from "@/shared/model/collection-status";

export type { CollectionStatus };

export type ServiceOrderStatus = "draft" | "budgeted" | "approved" | "in_service" | "ready" | "canceled" | "rejected";

export type ServiceOrder = Readonly<{
  id: string;
  organizationId: number;
  collectionId: string;
  administratorId: string;
  laborBrl: number;
  partsBrl: number;
  dueDays: number;
  status: ServiceOrderStatus;
  approvalSignerName: string | null;
  approvalSignerTaxId: string | null;
  checkInSignaturePath: string | null;
  createdAt: string;
}>;

export type BudgetItemProgress = "em_reparo" | "pronto";

export type BudgetItem = Readonly<{
  id: string;
  collectionItemId: string;
  laborCostBrl: number;
  partsCostBrl: number;
  estimatedDays: number;
  status: BudgetItemProgress | null;
  notes: string | null;
}>;

/** Item base da coleta (campo items de CollectionDetailDTO). */
export type CollectionItemSummary = Readonly<{
  id: string;
  description: string;
  quantity: number;
}>;

/** Resumo estrutural do cliente exibido no hub. */
export type CustomerSummary = Readonly<{
  name: string;
  taxId: string;
  phone: string;
}>;

/** Resumo estrutural do documento atual da coleta. */
export type CurrentDocumentSummary = Readonly<{
  id: string;
  version: number;
  status: "snapshot_ready" | "rendered" | "failed";
  issuedAt: string;
}>;

/** Visão do hub: subconjunto serializável do detalhe da coleta consumido pelo cliente. */
export type CollectionHubView = Readonly<{
  id: string;
  officialCode: string | null;
  status: CollectionStatus;
  customer: CustomerSummary | null;
  collectedAt: string | null;
  items: ReadonlyArray<CollectionItemSummary>;
  currentDocument: CurrentDocumentSummary | null;
}>;

/** Evento de timeline em forma serializável para o cliente. */
export type CollectionEventSummary = Readonly<{
  id: string;
  type: string;
  previousStatus: CollectionStatus | null;
  nextStatus: CollectionStatus | null;
  reason: string | null;
  actorName: string | null;
  createdAt: string;
}>;
