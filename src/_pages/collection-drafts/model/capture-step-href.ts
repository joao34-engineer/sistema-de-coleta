import type { CaptureStep } from "./capture-actor";

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
