import type { OfflineDraftRecord } from "./offline-records";

export type FinalizeSyncPresentation = "open_collection" | "queued_local" | "online_failed";

export function presentFinalizeSync(input: {
  wasOnline: boolean;
  leftover: OfflineDraftRecord | null;
  serverRowExists: boolean;
}): FinalizeSyncPresentation {
  if (!input.wasOnline) {
    return "queued_local";
  }
  if (input.leftover !== null) {
    return "online_failed";
  }
  if (input.serverRowExists) {
    return "open_collection";
  }
  return "queued_local";
}
