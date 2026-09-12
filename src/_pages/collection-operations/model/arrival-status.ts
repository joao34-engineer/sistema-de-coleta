export const ARRIVAL_UI_SEGMENTS = ["conferido", "divergencia", "nao_chegou"] as const;

export type ArrivalUiSegment = (typeof ARRIVAL_UI_SEGMENTS)[number];

export type ArrivalStatus = "arrived" | "missing";

export const ARRIVAL_SEGMENT_LABELS: Readonly<Record<ArrivalUiSegment, string>> = {
  conferido: "Conferido",
  divergencia: "Divergência",
  nao_chegou: "Não chegou",
};

export function arrivalStatusFromSegment(segment: ArrivalUiSegment): ArrivalStatus {
  return segment === "nao_chegou" ? "missing" : "arrived";
}

export function arrivalCounterLabel(total: number, missingCount: number): string {
  const received = Math.max(0, total - missingCount);
  return `Recebidos ${received} de ${total} · ${missingCount} não chegou`;
}

export function payloadConditionForSegment(
  segment: ArrivalUiSegment,
  conditionObserved: string,
): string {
  if (segment === "nao_chegou") {
    return "nao_recebido";
  }
  return conditionObserved.trim();
}

export function payloadQuantityForSegment(
  segment: ArrivalUiSegment,
  quantityObserved: number,
): number {
  if (segment === "nao_chegou") {
    return 0;
  }
  return quantityObserved;
}
