import {
  collectionStatusLabel,
  inRepairStatuses,
  type CollectionStatus,
} from "@/shared/model/collection-status";

const inRepairStatusesSet: ReadonlySet<CollectionStatus> = new Set(inRepairStatuses);

export type ListRowStatusTone = "brand" | "warning" | "muted";

export function listRowStatusLabel(status: CollectionStatus): string {
  if (status === "ready") return "Pronto";
  return collectionStatusLabel[status];
}

export function listRowStatusTone(status: CollectionStatus): ListRowStatusTone {
  if (status === "collected" || status === "ready") return "brand";
  if (status === "draft" || status === "canceled") return "muted";
  if (inRepairStatusesSet.has(status)) return "warning";
  return "muted";
}

export const listRowStatusClassName: Readonly<Record<ListRowStatusTone, string>> = {
  brand: "text-[var(--color-primary-strong)]",
  warning: "text-[var(--color-warning)]",
  muted: "text-[var(--color-text-muted)]",
};
