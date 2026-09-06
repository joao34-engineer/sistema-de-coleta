import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import type { CollectionEventSummary } from "@/_pages/collection-operations/model/view-models";
import { CollectionTimeline } from "@/_pages/collection-operations/ui/collection-timeline";

const createdAt = "2026-09-06T12:00:00.000Z";

function makeEvent(type: string): CollectionEventSummary {
  return {
    id: `event-${type}`,
    type,
    previousStatus: null,
    nextStatus: null,
    reason: null,
    actorName: null,
    createdAt,
  };
}

const emittedLabels: ReadonlyArray<readonly [string, string]> = [
  ["collection.draft.created", "Rascunho criado"],
  ["collection.draft.updated", "Rascunho atualizado"],
  ["collection.item.created", "Item adicionado"],
  ["collection.item.updated", "Item atualizado"],
  ["collection.item.removed", "Item removido"],
  ["collection.evidence.committed", "Evidência anexada"],
  ["collection.signature.committed", "Assinatura registrada"],
  ["collection.finalized", "Coleta finalizada"],
  ["collection.workshop.checked_in", "Entrada na oficina"],
  ["collection.budget.created", "Orçamento registrado"],
  ["collection.budget.approved", "Orçamento aprovado"],
  ["collection.budget.rejected", "Orçamento rejeitado"],
  ["collection.service.progress_updated", "Progresso atualizado"],
  ["collection.invoice.registered", "NF-e registrada"],
  ["collection.delivered", "Entrega ao cliente"],
  ["collection.canceled", "Coleta cancelada"],
  ["collection.reopened", "Coleta reaberta"],
];

describe("CollectionTimeline labels", () => {
  it.each(emittedLabels)("renders the Portuguese label for %s", (type, label) => {
    const html = renderToString(<CollectionTimeline events={[makeEvent(type)]} />);
    expect(html).toContain(label);
    expect(html).not.toContain(type);
  });

  it("falls back to the raw event type for unknown strings", () => {
    const type = "future.unknown.type";
    const html = renderToString(<CollectionTimeline events={[makeEvent(type)]} />);
    expect(html).toContain(type);
  });
});
