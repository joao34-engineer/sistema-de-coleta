"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { fetchDraftWithItemsAction, finalizeCollectionWithSignatureAction } from "../api/actions";
import type { DraftDTO, DraftItemDTO } from "../model/draft";

type Props = Readonly<{
  draftId: string;
  initialDraft?: DraftDTO | undefined;
  initialItems?: readonly DraftItemDTO[] | undefined;
}>;

const DEFAULT_ACCEPTANCE_TEXT =
  "Declaro que acompanhei a coleta das peças e equipamentos discriminados nesta guia, atestando a exatidão das quantidades e observações registradas.";

export function DraftSignaturePage({ draftId, initialDraft, initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<readonly DraftItemDTO[]>(initialItems ?? []);
  const [rowVersion, setRowVersion] = useState<number>(initialDraft?.rowVersion ?? 1);

  const [signerName, setSignerName] = useState(initialDraft?.responsibleName ?? "Ana Beatriz Silva");
  const [signerTaxId, setSignerTaxId] = useState(initialDraft?.responsibleTaxId ?? "00.000.000/0001-00");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(!initialDraft);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      fetchDraftWithItemsAction(draftId).then((res) => {
        setIsLoading(false);
        if (res.ok && res.draft) {
          setItems(res.items ?? []);
          setRowVersion(res.draft.rowVersion);
          if (res.draft.responsibleName && !signerName) {
            setSignerName(res.draft.responsibleName);
          }
          if (res.draft.responsibleTaxId && !signerTaxId) {
            setSignerTaxId(res.draft.responsibleTaxId);
          }
        } else {
          setErrorMsg("Rascunho de coleta não encontrado.");
        }
      });
    }
  }, [draftId, initialDraft, signerName, signerTaxId]);


  const handleFinalize = async () => {
    if (!signerName.trim()) {
      setErrorMsg("O nome de quem assinou é obrigatório.");
      return;
    }
    if (!signerTaxId.trim()) {
      setErrorMsg("O CPF/CNPJ de quem assinou é obrigatório.");
      return;
    }
    if (!signatureDataUrl) {
      setErrorMsg("Desenhe a assinatura no espaço abaixo.");
      return;
    }

    try {
      setIsFinalizing(true);
      setErrorMsg(null);

      const idempotencyKey = crypto.randomUUID();

      const res = await finalizeCollectionWithSignatureAction({
        collectionId: draftId,
        expectedVersion: rowVersion,
        signerName: signerName.trim(),
        signerTaxId: signerTaxId.trim(),
        acceptanceText: DEFAULT_ACCEPTANCE_TEXT,
        signatureBase64Png: signatureDataUrl,
        idempotencyKey,
      });

      if (!res.ok) {
        setErrorMsg(`Erro ao finalizar coleta: ${res.error}`);
        setIsFinalizing(false);
        return;
      }

      router.push(`/coletas/${draftId}/documentos` as Route);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao finalizar.";
      setErrorMsg(message);
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]">Carregando assinatura...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Assinatura do cliente"
        subtitle="Emissão da guia"
        backHref={`/coletas/${draftId}/revisao` as Route}
      />

      <div className="flex flex-col gap-5 px-6 pt-6">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Confirme a entrega dos itens descritos.
          </h2>
          <div className="mt-2 inline-flex items-center rounded-full bg-[var(--color-surface-green)] px-3 py-1 text-[13px] font-medium text-[var(--color-primary-dark)]">
            Guia MJT-2026-000021 · {items.length || 2} itens
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Canvas de Assinatura (Figma Node 13:87) */}
        <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            Assine no espaço abaixo
          </h3>
          <SignaturePad
            disabled={isFinalizing}
            onClear={() => setSignatureDataUrl(null)}
            onSave={(url) => setSignatureDataUrl(url)}
          />
          <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
            Assinatura do responsável pela entrega
          </span>
        </div>

        {/* Inputs do Signatário (Figma Node 13:87) */}
        <div className="flex flex-col gap-4">
          <Input
            label="Nome de quem assinou *"
            placeholder="Ana Beatriz Silva"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            required
          />

          <Input
            label="CPF/CNPJ de quem assinou *"
            placeholder="00.000.000/0001-00"
            value={signerTaxId}
            onChange={(e) => setSignerTaxId(e.target.value)}
            required
          />
        </div>

        {/* Botão Primário Finalizar coleta (Node 13:87) */}
        <Button
          type="button"
          variant="primary"
          isLoading={isFinalizing}
          onClick={() => void handleFinalize()}
          className="mt-3 h-[52px] rounded-[12px] text-[14px] font-semibold"
        >
          Finalizar coleta
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}

