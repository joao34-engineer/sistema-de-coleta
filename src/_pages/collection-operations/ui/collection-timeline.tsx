import type { CollectionEventSummary } from "../model/view-models";
import { collectionStatusLabel } from "@/shared/model/collection-status";
import { formatDateTimePtBr } from "@/shared/lib/format-date-time-pt-br";

type Props = Readonly<{ events: ReadonlyArray<CollectionEventSummary> }>;

const eventTypeLabels: Readonly<Record<string, string>> = {
  "collection.draft.created": "Rascunho criado",
  "collection.draft.updated": "Rascunho atualizado",
  "collection.item.created": "Item adicionado",
  "collection.item.updated": "Item atualizado",
  "collection.item.removed": "Item removido",
  "collection.evidence.committed": "Evidência anexada",
  "collection.signature.committed": "Assinatura registrada",
  "collection.finalized": "Coleta finalizada",
  "collection.workshop.checked_in": "Entrada na oficina",
  "collection.budget.created": "Orçamento registrado",
  "collection.budget.approved": "Orçamento aprovado",
  "collection.budget.rejected": "Orçamento rejeitado",
  "collection.service.progress_updated": "Progresso atualizado",
  "collection.invoice.registered": "NF-e registrada",
  "collection.delivered": "Entrega ao cliente",
  "collection.canceled": "Coleta cancelada",
  "collection.reopened": "Coleta reaberta",
};

function formatEventDate(value: string): string {
  return formatDateTimePtBr(value);
}

function describeTransition(event: CollectionEventSummary): string | null {
  const from = event.previousStatus ? collectionStatusLabel[event.previousStatus] : null;
  const to = event.nextStatus ? collectionStatusLabel[event.nextStatus] : null;
  if (from && to) return `${from} → ${to}`;
  return null;
}

export function CollectionTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const transition = describeTransition(event);
        return (
          <li key={event.id} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {eventTypeLabels[event.type] ?? event.type}
                </span>
                <time className="text-[11px] font-normal text-[var(--color-text-muted)]" dateTime={event.createdAt}>
                  {formatEventDate(event.createdAt)}
                </time>
              </div>
              {transition ? (
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{transition}</span>
              ) : null}
              {event.reason ? (
                <span className="break-words text-[12px] font-normal text-[var(--color-text-primary)]">{event.reason}</span>
              ) : null}
              {event.actorName ? (
                <span className="text-[11px] font-normal text-[var(--color-text-muted)]">Por {event.actorName}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
