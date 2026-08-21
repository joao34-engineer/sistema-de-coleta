"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { fetchDraftWithItemsAction } from "../api/actions";
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
  const [isLoading, setIsLoading] = useState<boolean>(!initialDraft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      fetchDraftWithItemsAction(draftId).then((res) => {
        setIsLoading(false);
        if (res.ok && res.draft) {
          setDraft(res.draft);
          setItems(res.items ?? []);
        } else {
          setErrorMsg("Rascunho de coleta não encontrado.");
        }
      });
    }
  }, [draftId, initialDraft]);

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]">Carregando revisão...</p>
      </main>
    );
  }

  if (errorMsg || !draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] px-6 py-12 text-center">
        <div className="rounded-[12px] bg-[#fdf2f1] p-4 text-[12px] font-semibold text-[#ba5b52]">
          {errorMsg ?? "Rascunho de coleta não encontrado."}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Revisar coleta"
        subtitle="Etapa 3 de 3"
        backHref={`/coletas/${draftId}/itens` as Route}
      />

      {/* Progress Bar (M04 Node 13:68: 3 de 3 ativas) */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
        </div>
        <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
          3 de 3
        </span>
      </div>

      <div className="flex flex-col gap-6 px-6 pt-6">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Confira antes de emitir.
          </h2>
        </div>

        {/* Card CLIENTE (Node 13:68) */}
        <div className="flex flex-col gap-1 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            CLIENTE
          </span>
          <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            {draft.responsibleName || "Clínica Horizonte"}
          </h3>
          <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
            CNPJ / CPF · {draft.responsibleTaxId || "00.000.000/0001-00"}
          </p>
        </div>


        {/* Card ITENS (Node 13:68) */}
        <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            ITENS · {items.length}
          </span>
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <p key={item.id} className="text-[14px] font-normal text-[var(--color-text-primary)]">
                {item.description}
              </p>
            ))}
          </div>
        </div>

        {/* Card LOCAL DA COLETA (Node 13:68) */}
        <div className="flex flex-col gap-1 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            LOCAL DA COLETA
          </span>
          <p className="text-[13px] font-normal text-[var(--color-text-primary)]">
            {draft.collectionLocation || "Rua das Flores, 120 · Centro"}
          </p>
        </div>

        {/* Botão Primário Emitir guia e coletar assinatura (Node 13:68) */}
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push(`/coletas/${draftId}/assinatura` as Route)}
          className="mt-4 h-[52px] rounded-[12px] text-[14px] font-semibold"
          disabled={items.length === 0}
        >
          Emitir guia e coletar assinatura
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}

