import type { SyncUxState } from "../model/capture-actor";
import { offlineCopy } from "../model/offline-copy";

const labels: Readonly<Record<SyncUxState, string>> = {
  online: offlineCopy.online,
  saved_locally: offlineCopy.savedLocally,
  syncing: offlineCopy.syncing,
  synced: offlineCopy.synced,
  failed: offlineCopy.failed,
};

export function SyncStatusChip({ state }: { readonly state: SyncUxState }) {
  const tone =
    state === "failed"
      ? "bg-[#fdf2f1] text-[#ba5b52]"
      : state === "syncing"
        ? "bg-[#fff8ec] text-[#a36b2c]"
        : "bg-[var(--color-surface-green)] text-[var(--color-primary-dark)]";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${tone}`}>
      {labels[state]}
    </span>
  );
}
