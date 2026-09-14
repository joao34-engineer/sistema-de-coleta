import { describe, expect, it } from "vitest";
import {
  arrivalCounterLabel,
  arrivalStatusFromSegment,
  payloadConditionForSegment,
  payloadQuantityForSegment,
} from "@/_pages/collection-operations/model/arrival-status";

describe("arrival-status helpers", () => {
  it("maps UI segments to RPC arrival_status", () => {
    expect(arrivalStatusFromSegment("conferido")).toBe("arrived");
    expect(arrivalStatusFromSegment("divergencia")).toBe("arrived");
    expect(arrivalStatusFromSegment("nao_chegou")).toBe("missing");
  });

  it("builds the O02b counter copy", () => {
    expect(arrivalCounterLabel(2, 1)).toBe("2 itens · 1 não chegou");
    expect(arrivalCounterLabel(2, 0)).toBe("2 itens");
  });

  it("forces missing payload to qty 0 and the canonical condition", () => {
    expect(payloadQuantityForSegment("nao_chegou", 4)).toBe(0);
    expect(payloadConditionForSegment("nao_chegou", "ok")).toBe("nao_recebido");
    expect(payloadQuantityForSegment("conferido", 4)).toBe(4);
    expect(payloadConditionForSegment("conferido", "  sem avarias  ")).toBe("sem avarias");
  });
});
