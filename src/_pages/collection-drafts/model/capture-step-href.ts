import type { CaptureStep } from "./capture-actor";
import { hasRequiredCollectionLocation } from "./has-required-collection-location";
import type { OfflineDraftRecord } from "./offline-records";

/** Canonical path for a capture wizard step after a draft id exists. */
export function captureStepHref(id: string, step: CaptureStep): string {
  switch (step) {
    case "cliente":
      return "/coletas/nova";
    case "itens":
      return `/coletas/${id}/itens`;
    case "revisao":
      return `/coletas/${id}/revisao`;
    case "assinatura":
      return `/coletas/${id}/assinatura`;
  }
}

/** Resume path for a pending offline draft — routes to the step that can fix blockers. */
export function pendingResumeHref(
  draft: Pick<OfflineDraftRecord, "id" | "currentStep" | "lastError" | "collectionLocation">,
): string {
  if (
    draft.lastError === "collection_incomplete" ||
    !hasRequiredCollectionLocation(draft.collectionLocation)
  ) {
    return `/coletas/${draft.id}/revisao`;
  }
  if (draft.currentStep === "assinatura") {
    return captureStepHref(draft.id, "assinatura");
  }
  return captureStepHref(draft.id, draft.currentStep);
}
