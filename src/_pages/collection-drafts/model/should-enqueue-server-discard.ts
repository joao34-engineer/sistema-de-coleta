import type { OfflineDraftRecord, OfflineMutationRecord } from "./offline-records";

export function shouldEnqueueServerDiscard(
  draft: OfflineDraftRecord,
  mutations: readonly OfflineMutationRecord[],
): boolean {
  const createDraftTouched = mutations.some(
    (row) => row.kind === "create_draft" && (row.status === "done" || row.status === "in_flight"),
  );
  return draft.serverRowVersion !== null || createDraftTouched;
}
