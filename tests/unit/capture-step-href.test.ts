import { describe, expect, it } from "vitest";
import { captureStepHref } from "@/_pages/collection-drafts/model/capture-step-href";

const draftId = "22222222-2222-4222-8222-222222222222";

describe("captureStepHref", () => {
  it("maps cliente to the new-capture entry", () => {
    expect(captureStepHref(draftId, "cliente")).toBe("/coletas/nova");
  });

  it("maps wizard steps to deep links under the draft id", () => {
    expect(captureStepHref(draftId, "itens")).toBe(`/coletas/${draftId}/itens`);
    expect(captureStepHref(draftId, "revisao")).toBe(`/coletas/${draftId}/revisao`);
    expect(captureStepHref(draftId, "assinatura")).toBe(`/coletas/${draftId}/assinatura`);
  });
});
