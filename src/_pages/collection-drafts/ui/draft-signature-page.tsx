"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
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

      // Sucesso na finalização -> Redirecionar para visualização de documentos ou dashboard
      router.push(`/coletas/${draftId}/documentos` as Route);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao finalizar.";
      setErrorMsg(message);
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-[var(--color-text-muted,#6b7280)]">Carregando tela de assinatura...</p>
      </main>
    );
  }

  if (errorMsg && !draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-12 text-center">
        <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
        <Link href={"/dashboard" as Route} className="mt-4 inline-block">
          <Button variant="secondary" size="sm">Voltar ao Painel</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6 pb-24">
      {/* Header Mobile */}
      <header className="mb-4 flex items-center justify-between border-b border-[var(--color-border,#dee4e0)] pb-3">
        <Link href={`/coletas/${draftId}/revisao` as Route}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            ← Voltar para Revisão
          </Button>
        </Link>
        <div className="text-right">
          <Badge status="draft">M05 · Assinatura</Badge>
          <span className="mt-0.5 block text-[10px] text-[var(--color-text-muted,#6b7280)]">Passo 4 de 4</span>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {/* Banner do Rascunho */}
        <Card className="bg-[var(--color-surface-neutral,#eff2f0)]">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-muted,#6b7280)] uppercase">
                Finalização #{draftId.substring(0, 8)}
              </span>
              <Badge status="draft">{items.length} itens a coletar</Badge>
            </div>
          </CardHeader>
        </Card>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Dados do Signatário */}
        <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">
              Identificação do Signatário *
            </h3>
            <p className="text-xs text-[var(--color-text-muted,#6b7280)]">
              Confirme o nome e documento da pessoa que assinará o recibo de coleta.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
                Nome do Signatário *
              </label>
              <Input
                placeholder="Ex: Carlos Eduardo Silva"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
                CPF / CNPJ do Signatário *
              </label>
              <Input
                placeholder="Ex: 000.000.000-00"
                value={signerTaxId}
                onChange={(e) => setSignerTaxId(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Canvas de Assinatura Digital */}
        <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">
                Assinatura Digital *
              </h3>
              {signatureDataUrl && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ Assinatura Confirmada
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted,#6b7280)]">
              Assine no quadro abaixo usando a tela sensível ao toque ou o cursor do mouse.
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
        <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
          <CardContent className="pt-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-border,#dee4e0)] text-[var(--color-primary,#4c916f)] focus:ring-[var(--color-primary,#4c916f)]"
              />
              <span className="text-xs text-[var(--color-text-primary,#111827)] leading-relaxed">
                {DEFAULT_ACCEPTANCE_TEXT}
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Rodapé Fixo com Botão Transacional */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-card-bg,#ffffff)] p-4 shadow-lg border-t border-[var(--color-border,#dee4e0)]">
          <div className="mx-auto max-w-lg">
            <Button
              className="w-full min-h-[48px] text-sm font-bold shadow-md"
              disabled={!signatureDataUrl || !acceptedTerms || !signerName || !signerTaxId || isFinalizing}
              isLoading={isFinalizing}
              type="button"
              variant="primary"
              onClick={() => void handleFinalize()}
            >
              Finalizar Coleta e Emitir Recibo ✓
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
