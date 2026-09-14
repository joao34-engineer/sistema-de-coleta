"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentJobStatus } from "../api/delivery/contracts";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { Button } from "@/shared/ui/button";

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
  const [pollEpoch, setPollEpoch] = useState(0);
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
  }, [pending, router, refreshMs, maxRefreshes, pollEpoch]);

  async function handleRetry(): Promise<void> {
    setRetryBusy(true);
    setRetryMessage(null);
    try {
      const response = await fetch(`/api/collections/${collectionId}/documents/${documentId}/retry`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("document_retry_failed");
      setExhausted(false);
      setPollEpoch((epoch) => epoch + 1);
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

  if (failed || exhausted) {
    return (
      <div role="status">
        <MobileStatePanel
          type="error"
          title="Não foi possível gerar o PDF"
          subtitle={
            failed
              ? "A geração da guia falhou. Tente novamente. O conteúdo da coleta não foi alterado."
              : "O PDF ainda está na fila. Tente de novo para gerar agora."
          }
          actionText={retryBusy ? "Tentando novamente…" : "Tentar de novo"}
          actionDisabled={retryBusy}
          onAction={() => void handleRetry()}
          footer={
            retryMessage ? (
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{retryMessage}</p>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div role="status">
      <MobileStatePanel
        type="loading"
        title="Gerando o PDF"
        subtitle="A guia está sendo gerada. Esta tela atualiza sozinha em alguns segundos."
        actionSlot={
          <Button type="button" variant="primary" size="md" disabled>
            Aguarde
          </Button>
        }
      />
    </div>
  );
}
