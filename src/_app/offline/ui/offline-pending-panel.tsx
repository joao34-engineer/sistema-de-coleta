import Link from "next/link";
import type { Route } from "next";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  drafts: readonly OfflineDraftRecord[];
  busy: boolean;
  onRetry: () => void;
  onDiscard: (draftId: string) => void;
}>;

const stepLabel: Readonly<Record<OfflineDraftRecord["currentStep"], string>> = {
  cliente: offlineCopy.stepCliente,
  itens: offlineCopy.stepItens,
  revisao: offlineCopy.stepRevisao,
  assinatura: offlineCopy.stepAssinatura,
};

export function OfflinePendingPanel({ drafts, busy, onRetry, onDiscard }: Props) {
  const first = drafts[0];
  if (first === undefined) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-md p-3">
      <section
        aria-labelledby="offline-pending-title"
        className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-surface)]"
        role="status"
      >
        <h2 id="offline-pending-title" className="text-[15px] font-semibold text-[var(--color-text)]">
          {offlineCopy.pendingTitle}
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-[var(--color-text)]">
                {draft.customer.displayName} · {stepLabel[draft.currentStep]}
              </span>
              <Link className="font-semibold text-[var(--color-primary-strong)]" href={`/coletas/nova?rascunho=${draft.id}` as Route}>
                {offlineCopy.resume}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-2">
          <Button type="button" variant="primary" isLoading={busy} onClick={onRetry}>
            {offlineCopy.retry}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onDiscard(first.id)}>
            {offlineCopy.discard}
          </Button>
        </div>
      </section>
    </div>
  );
}
