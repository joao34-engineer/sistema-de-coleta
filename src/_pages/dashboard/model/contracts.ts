import { z } from "zod";
import { collectionStatusLabel, type CollectionStatus, isReadyForDelivery } from "@/shared/model/collection-status";

export const dashboardSummarySchema = z.object({
  inProgress: z.number().int().nonnegative(),
  readyForDelivery: z.number().int().nonnegative(),
});

export type DashboardSummaryDTO = z.output<typeof dashboardSummarySchema>;

export type DashboardActivityStatus = CollectionStatus;

/** DTO mínimo do dashboard: sem dados de contato do cliente. */
export type DashboardActivityItem = Readonly<{
  id: string;
  officialCode: string | null;
  status: DashboardActivityStatus;
  customerName: string | null;
  createdAt: string;
}>;

export function formatDashboardDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(now);
}

export function dashboardActivityStatusLabel(status: DashboardActivityStatus): string {
  if (status === "ready") return "Pronto";
  return collectionStatusLabel[status];
}

const notInProgressStatuses: ReadonlySet<DashboardActivityStatus> = new Set(["draft", "canceled", "delivered"]);

export function countInProgress(items: ReadonlyArray<DashboardActivityItem>): number {
  return items.filter((item) => !notInProgressStatuses.has(item.status)).length;
}

export function countReadyForDelivery(items: ReadonlyArray<DashboardActivityItem>): number {
  return items.filter((item) => isReadyForDelivery(item.status)).length;
}

export function latestActivities(
  items: ReadonlyArray<DashboardActivityItem>,
  limit: number,
): ReadonlyArray<DashboardActivityItem> {
  return [...items]
    .filter((item) => item.status !== "draft")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
