"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--color-muted)]">Carregando dados da revisão...</p>
      </main>
    );
  }

  if (errorMsg || !draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center">
        <div className="rounded-[12px] bg-[#fdf2f1] p-4 text-[12px] font-semibold text-[#ba5b52]">
          {errorMsg ?? "Rascunho de coleta não encontrado."}
        </div>
      </main>
    );
  }

  const canProceed = items.length > 0 && Boolean(draft.responsibleName);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Revisão da coleta"
        subtitle="Passo 3 de 4"
        backHref={`/coletas/${draftId}/itens` as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Confira tudo antes de assinar.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Rascunho #{draftId.substring(0, 8)} · v{rowVersion}
          </p>
        </div>

        {/* Card de Responsável na Origem */}
        <ResponsibleSignatoryCard
          initialName={draft.responsibleName}
          initialTaxId={draft.responsibleTaxId}
          onSave={handleSaveResponsible}
        />

        {/* Resumo dos Equipamentos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Equipamentos na coleta ({items.length})
              </h3>
              <p className="text-[12px] text-[var(--color-muted)]">
                Verifique as peças antes da assinatura.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-4 text-center text-[12px] font-semibold text-[#ba5b52]">
                ⚠️ É necessário ter pelo menos 1 item para prosseguir.
              </p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between py-2.5">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--color-text)]">
                        {item.quantity}x {item.description}
                      </p>
                      {item.notes && (
                        <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    {item.condition && (
                      <Badge status="ready">{item.condition}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ação de Avançar */}
        <div className="mt-2 flex flex-col gap-2">
          {!canProceed && (
            <p className="text-center text-[12px] font-semibold text-[#a36b2c]">
              {!items.length
                ? "Adicione pelo menos um item para avançar."
                : "Confirme o responsável pela entrega acima para avançar."}
            </p>
          )}
          <Button
            size="md"
            disabled={!canProceed}
            type="button"
            variant="primary"
            onClick={() => router.push(`/coletas/${draftId}/assinatura` as Route)}
          >
            Ir para a assinatura →
          </Button>
        </div>
      </div>

      <MobileBottomNav />
    </main>
  );
}
