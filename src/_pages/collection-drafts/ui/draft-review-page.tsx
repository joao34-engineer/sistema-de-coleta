"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { fetchDraftWithItemsAction, updateDraftResponsibleAction } from "../api/actions";
import { ResponsibleSignatoryCard } from "./responsible-signatory-card";
import type { DraftDTO, DraftItemDTO } from "../model/draft";

type Props = Readonly<{
  draftId: string;
  initialDraft?: DraftDTO | undefined;
  initialItems?: readonly DraftItemDTO[] | undefined;
}>;

export function DraftReviewPage({ draftId, initialDraft, initialItems }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftDTO | null>(initialDraft ?? null);
  const [items, setItems] = useState<readonly DraftItemDTO[]>(initialItems ?? []);
  const [rowVersion, setRowVersion] = useState<number>(initialDraft?.rowVersion ?? 1);
  const [isLoading, setIsLoading] = useState<boolean>(!initialDraft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      fetchDraftWithItemsAction(draftId).then((res) => {
        setIsLoading(false);
        if (res.ok && res.draft) {
          setDraft(res.draft);
          setItems(res.items ?? []);
          setRowVersion(res.draft.rowVersion);
        } else {
          setErrorMsg("Rascunho de coleta não encontrado.");
        }
      });
    }
  }, [draftId, initialDraft]);

  const handleSaveResponsible = async (data: {
    responsibleName: string;
    responsibleTaxId: string | null;
  }) => {
    const res = await updateDraftResponsibleAction({
      collectionId: draftId,
      expectedVersion: rowVersion,
      ...data,
    });

    if (!res.ok) {
      if (res.error === "stale_version") {
        const refreshed = await fetchDraftWithItemsAction(draftId);
        if (refreshed.ok && refreshed.draft) {
          setDraft(refreshed.draft);
          setRowVersion(refreshed.draft.rowVersion);
        }
      }
      throw new Error(res.error);
    }

    setDraft(res.draft);
    setRowVersion(res.draft.rowVersion);
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-[var(--color-muted,#6b7280)]">Carregando dados da revisão...</p>
      </main>
    );
  }

  if (errorMsg || !draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-12 text-center">
        <div className="rounded-lg bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMsg ?? "Rascunho de coleta não encontrado."}
        </div>
        <Link href={"/dashboard" as Route} className="mt-4 inline-block">
          <Button variant="secondary" size="sm">Voltar ao Painel</Button>
        </Link>
      </main>
    );
  }

  const canProceed = items.length > 0 && Boolean(draft.responsibleName);

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6 pb-20">
      {/* Header Mobile */}
      <header className="mb-4 flex items-center justify-between border-b border-[var(--color-border,#dee4e0)] pb-3">
        <Link href={`/coletas/${draftId}/itens` as Route}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            ← Itens
          </Button>
        </Link>
        <div className="text-right">
          <Badge status="draft">M04 · Revisão</Badge>
          <span className="mt-0.5 block text-[10px] text-[var(--color-text-muted,#6b7280)]">Passo 3 de 4</span>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {/* Banner do Rascunho */}
        <Card className="bg-[var(--color-surface-neutral,#eff2f0)]">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-muted,#6b7280)] uppercase">
                Revisão do Rascunho #{draftId.substring(0, 8)}
              </span>
              <Badge status="draft">v{rowVersion}</Badge>
            </div>
            {draft.collectionLocation && (
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-primary,#111827)]">
                📍 Retirada: {draft.collectionLocation}
              </p>
            )}
          </CardHeader>
        </Card>

        {/* Card de Responsável na Origem */}
        <ResponsibleSignatoryCard
          initialName={draft.responsibleName}
          initialTaxId={draft.responsibleTaxId}
          onSave={handleSaveResponsible}
        />

        {/* Resumo dos Itens Cadastrados */}
        <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">
                Resumo dos Equipamentos ({items.length})
              </h3>
              <p className="text-xs text-[var(--color-text-muted,#6b7280)]">
                Verifique as peças antes de solicitar a assinatura.
              </p>
            </div>
            <Link href={`/coletas/${draftId}/itens` as Route}>
              <Button variant="ghost" size="sm" className="text-xs text-[var(--color-primary,#4c916f)]">
                Editar
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-red-600 font-medium">
                ⚠️ É necessário ter pelo menos 1 item para prosseguir.
              </p>
            ) : (
              <div className="divide-y divide-[var(--color-border,#dee4e0)]">
                {items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary,#111827)]">
                        {item.quantity}x {item.description}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-[var(--color-text-muted,#6b7280)] mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    {item.condition && (
                      <span className="rounded bg-[var(--color-surface-green,#eef8f2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary,#4c916f)]">
                        {item.condition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé Fixo de Ação */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-card-bg,#ffffff)] p-4 shadow-lg border-t border-[var(--color-border,#dee4e0)]">
          <div className="mx-auto max-w-lg">
            {!canProceed && (
              <p className="mb-2 text-center text-xs font-medium text-amber-700">
                {!items.length
                  ? "Adicione pelo menos um item para avançar."
                  : "Confirme o responsável pela entrega acima para avançar."}
              </p>
            )}
            <Button
              className="w-full min-h-[48px] text-sm font-bold"
              disabled={!canProceed}
              type="button"
              variant="primary"
              onClick={() => router.push(`/coletas/${draftId}/assinatura` as Route)}
            >
              Avançar para Assinatura →
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
