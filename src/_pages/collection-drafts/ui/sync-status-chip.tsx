import type { SyncUxState } from "../model/capture-actor";
import { messageForQueueError, offlineCopy } from "../model/offline-copy";

const labels: Readonly<Record<SyncUxState, string>> = {
  online: offlineCopy.online,
  saved_locally: offlineCopy.savedLocally,
  syncing: offlineCopy.syncing,
  synced: offlineCopy.synced,
  failed: offlineCopy.failed,
};

type Props = Readonly<{
  state: SyncUxState;
  lastError?: string | null;
}>;

export function SyncStatusChip({ state, lastError }: Props) {
  const tone =
    state === "failed"
      ? "bg-[#fdf2f1] text-[#ba5b52]"
      : state === "syncing"
        ? "bg-[#fff8ec] text-[#a36b2c]"
        : "bg-[var(--color-surface-green)] text-[var(--color-primary-dark)]";

  const mapped =
    state === "failed" && lastError !== null && lastError !== undefined && lastError.trim() !== ""
      ? messageForQueueError(lastError)
      : null;
  const label = mapped ?? labels[state];
  const title = mapped !== null && mapped !== offlineCopy.failed ? mapped : undefined;

  return (
    <span
      className={`inline-flex max-w-[220px] items-center truncate rounded-full px-3 py-1 text-[12px] font-medium ${tone}`}
      title={title}
    >
      {label}
    </span>
  );
}
