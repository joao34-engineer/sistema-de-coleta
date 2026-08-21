"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
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
  const [draft, setDraft] = useState<DraftDTO | null>(initialDraft ?? null);
  const [items, setItems] = useState<readonly DraftItemDTO[]>(initialItems ?? []);
  const [rowVersion, setRowVersion] = useState<number>(initialDraft?.rowVersion ?? 1);

  const [signerName, setSignerName] = useState(initialDraft?.responsibleName ?? "");
  const [signerTaxId, setSignerTaxId] = useState(initialDraft?.responsibleTaxId ?? "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(!initialDraft);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      fetchDraftWithItemsAction(draftId).then((res) => {
        setIsLoading(false);
        if (res.ok && res.draft) {
          setDraft(res.draft);
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
      setErrorMsg("O nome do signatário é obrigatório.");
      return;
    }
    if (!signerTaxId.trim()) {
      setErrorMsg("O CPF ou CNPJ do signatário é obrigatório.");
      return;
    }
    if (!signatureDataUrl) {
      setErrorMsg("Capture e confirme a assinatura digital antes de finalizar.");
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg("É necessário aceitar os termos de confirmação da coleta.");
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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--color-muted)]">Carregando tela de assinatura...</p>
      </main>
    );
  }

  if (errorMsg && !draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center">
        <div className="rounded-[12px] bg-[#fdf2f1] p-4 text-[12px] font-semibold text-[#ba5b52]">
          {errorMsg}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Assinatura do cliente"
        subtitle="Passo 4 de 4"
        backHref={`/coletas/${draftId}/revisao` as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Coleta no local concluída.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Finalização #{draftId.substring(0, 8)} · {items.length} itens
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Dados do Signatário */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Identificação de quem assina *
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              label="Nome de quem assina *"
              placeholder="Ex: Carlos Eduardo Silva"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
            <Input
              label="CPF ou CNPJ de quem assina *"
              placeholder="Ex: 000.000.000-00"
              value={signerTaxId}
              onChange={(e) => setSignerTaxId(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Canvas de Assinatura Digital */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Assinatura digital *
              </h3>
              {signatureDataUrl && (
                <Badge status="collected">✓ Confirmada</Badge>
              )}
            </div>
            <p className="text-[12px] text-[var(--color-muted)]">
              Assine no quadro abaixo usando a tela sensível ao toque.
            </p>
          </CardHeader>
          <CardContent>
            <SignaturePad
              disabled={isFinalizing}
              onClear={() => setSignatureDataUrl(null)}
              onSave={(url) => setSignatureDataUrl(url)}
            />
          </CardContent>
        </Card>

        {/* Termo de Aceite Jurídico */}
        <Card>
          <CardContent className="pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-[11px] leading-relaxed text-[var(--color-text)]">
                {DEFAULT_ACCEPTANCE_TEXT}
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Botão Transacional */}
        <div className="mt-2 flex flex-col gap-2">
          <Button
            size="md"
            disabled={!signatureDataUrl || !acceptedTerms || !signerName || !signerTaxId || isFinalizing}
            isLoading={isFinalizing}
            type="button"
            variant="primary"
            onClick={() => void handleFinalize()}
          >
            Finalizar coleta e emitir recibo ✓
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
