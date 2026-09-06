import { describe, expect, it } from "vitest";
import { captureStepHref, pendingResumeHref } from "@/_pages/collection-drafts/model/capture-step-href";

const draftId = "22222222-2222-4222-8222-222222222222";

const resumeDraftBase = {
  id: draftId,
  currentStep: "assinatura" as const,
  lastError: null as string | null,
  collectionLocation: "Galpão 2",
};

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

describe("pendingResumeHref", () => {
  it("routes incomplete or missing location to revisao", () => {
    expect(pendingResumeHref({ ...resumeDraftBase, collectionLocation: null })).toBe(`/coletas/${draftId}/revisao`);
    expect(pendingResumeHref({ ...resumeDraftBase, collectionLocation: "   " })).toBe(`/coletas/${draftId}/revisao`);
    expect(
      pendingResumeHref({
        ...resumeDraftBase,
        lastError: "collection_incomplete",
        collectionLocation: "Galpão 2",
      }),
    ).toBe(`/coletas/${draftId}/revisao`);
  });

  it("routes assinatura step with location to assinatura", () => {
    expect(
      pendingResumeHref({
        ...resumeDraftBase,
        currentStep: "assinatura",
        collectionLocation: "Galpão 2",
      }),
    ).toBe(`/coletas/${draftId}/assinatura`);
  });

  it("routes itens step with location to itens", () => {
    expect(
      pendingResumeHref({
        ...resumeDraftBase,
        currentStep: "itens",
        collectionLocation: "Galpão 2",
      }),
    ).toBe(`/coletas/${draftId}/itens`);
  });
});
