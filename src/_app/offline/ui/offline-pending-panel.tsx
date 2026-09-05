import Link from "next/link";
import type { Route } from "next";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { messageForQueueError, offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  drafts: readonly OfflineDraftRecord[];
  busy: boolean;
  notice?: string | null;
  bannerError?: string | null;
  onRetry: () => void;
  onDiscard: (draftId: string) => void;
}>;

const stepLabel: Readonly<Record<OfflineDraftRecord["currentStep"], string>> = {
  cliente: offlineCopy.stepCliente,
  itens: offlineCopy.stepItens,
  revisao: offlineCopy.stepRevisao,
  assinatura: offlineCopy.stepAssinatura,
};

export function OfflinePendingPanel({
  drafts,
  busy,
  notice = null,
  bannerError = null,
  onRetry,
  onDiscard,
}: Props) {
  const ordered = [...drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const first = ordered[0];
  if (first === undefined && notice === null && bannerError === null) {
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
          {first === undefined && notice !== null ? notice : offlineCopy.pendingTitle}
        </h2>
        {notice !== null && first !== undefined ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-text)]">{notice}</p>
        ) : null}
        {bannerError ? <p className="mt-2 text-[12px] font-medium text-[#ba5b52]">{bannerError}</p> : null}
        {ordered.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {ordered.map((draft) => {
              const errorText =
                draft.lastError !== null && draft.lastError !== undefined && draft.lastError.trim() !== ""
                  ? messageForQueueError(draft.lastError)
                  : null;
              return (
                <li key={draft.id} className="flex flex-col gap-1 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--color-text)]">
                      {draft.customer.displayName} · {stepLabel[draft.currentStep]}
                    </span>
                    <Link
                      className="font-semibold text-[var(--color-primary-strong)]"
                      href={`/coletas/${draft.id}/itens` as Route}
                    >
                      {offlineCopy.resume}
                    </Link>
                  </div>
                  {errorText ? <p className="text-[12px] font-medium text-[#ba5b52]">{errorText}</p> : null}
                  <Button type="button" variant="secondary" onClick={() => onDiscard(draft.id)}>
                    {offlineCopy.discard}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {ordered.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            <Button type="button" variant="primary" isLoading={busy} onClick={onRetry}>
              {offlineCopy.retry}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
