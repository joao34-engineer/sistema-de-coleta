import { type CollectionStatus, isReadyForDelivery } from "@/shared/model/collection-status";

export type DashboardActivityStatus = CollectionStatus;

/** DTO mínimo do dashboard: sem dados de contato do cliente. */
export type DashboardActivityItem = Readonly<{
  id: string;
  officialCode: string | null;
  status: DashboardActivityStatus;
  customerName: string | null;
  createdAt: string;
}>;

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
