"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentJobStatus } from "../api/delivery/contracts";

const REFRESH_MS = 3000;
const MAX_REFRESHES = 20;

type Props = Readonly<{
  collectionId: string;
  documentId: string;
  hasPdf: boolean;
  pdfJobStatus?: DocumentJobStatus;
  refreshMs?: number;
  maxRefreshes?: number;
}>;

/** Shows PDF progress, honest failure, or retry while the artifact is missing. */
export function PdfPendingStatus({
  collectionId,
  documentId,
  hasPdf,
  pdfJobStatus,
  refreshMs = REFRESH_MS,
  maxRefreshes = MAX_REFRESHES,
}: Props) {
  const router = useRouter();
  const [exhausted, setExhausted] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const failed = !hasPdf && pdfJobStatus === "failed";
  const pending = !hasPdf && !failed;

  useEffect(() => {
    if (!pending) {
      return;
    }
    let ticks = 0;
    const resetTimer = window.setTimeout(() => {
      setExhausted(false);
    }, 0);
    const timer = window.setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= maxRefreshes) {
        window.clearInterval(timer);
        setExhausted(true);
      }
    }, refreshMs);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
    };
  }, [pending, router, refreshMs, maxRefreshes]);

  async function handleRetry(): Promise<void> {
    setRetryBusy(true);
    setRetryMessage(null);
    try {
      const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/retry`, { method: "POST" });
      if (!response.ok) throw new Error("document_retry_failed");
      router.refresh();
    } catch {
      setRetryMessage("Não foi possível tentar de novo.");
    } finally {
      setRetryBusy(false);
    }
  }

  if (hasPdf) {
    return null;
  }

  if (failed) {
    return (
      <div
        role="status"
        className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-medium text-[var(--color-text-primary)]"
      >
        <p>Não foi possível gerar o PDF desta guia. Tente de novo ou aguarde alguns minutos.</p>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={retryBusy}
          className="mt-2 text-[13px] font-semibold text-[var(--color-primary)] disabled:opacity-60"
        >
          {retryBusy ? "Tentando novamente…" : "Tentar de novo"}
        </button>
        {retryMessage ? <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{retryMessage}</p> : null}
      </div>
    );
  }

  return (
    <p
      role="status"
      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-medium text-[var(--color-text-primary)]"
    >
      {exhausted
        ? "O PDF ainda está sendo processado. Atualize a página em instantes."
        : "Gerando o PDF da guia. Isso leva alguns segundos. Depois você pode baixar ou compartilhar no WhatsApp."}
    </p>
  );
}
