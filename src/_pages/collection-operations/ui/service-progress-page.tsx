"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { updateServiceProgressAction } from "@/_app/actions/phase3-flow.actions";

export type ProgressItem = Readonly<{
  itemId: string;
  itemDescription: string;
  status: "em_reparo" | "pronto";
  notes: string | null;
}>;

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  progressItems: ReadonlyArray<ProgressItem>;
  rowVersion: number;
}>;

type EditableProgressItem = {
  itemId: string;
  itemDescription: string;
  status: "em_reparo" | "pronto";
  notes: string;
};

const statusOptions = [
  { value: "em_reparo", label: "Em reparo" },
  { value: "pronto", label: "Pronto" },
] as const;

export function ServiceProgressPage({ collectionId, officialCode, progressItems, rowVersion }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<EditableProgressItem[]>(
    progressItems.map((item) => ({ itemId: item.itemId, itemDescription: item.itemDescription, status: item.status, notes: item.notes ?? "" })),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const readyCount = items.filter((item) => item.status === "pronto").length;

  function updateItem(itemId: string, patch: Partial<EditableProgressItem>) {
    setItems((current) => current.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)));
  }

  async function handleSubmit() {
    if (items.some((item) => item.notes.length > 1000)) {
      setErrorMsg("As observações devem ter no máximo 1000 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await updateServiceProgressAction(
        collectionId,
        {
          collectionId,
          expectedVersion: rowVersion,
          items: items.map((item) => ({
            itemId: item.itemId,
            itemDescription: item.itemDescription,
            status: item.status,
            notes: item.notes.trim() === "" ? null : item.notes.trim(),
          })),
        },
        crypto.randomUUID(),
      );

      if (!result.ok) {
        setErrorMsg(result.error);
        setIsSubmitting(false);
        return;
      }

      router.push(`/coletas/${collectionId}` as Route);
    } catch {
      setErrorMsg("Não foi possível salvar o progresso. Verifique a conexão e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Progresso do reparo"
        subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        <div className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">Itens prontos</span>
          <span className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            {readyCount} de {items.length}
          </span>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {items.map((item) => (
          <Card key={item.itemId} className="flex flex-col gap-3">
            <span className="break-words text-[14px] font-semibold text-[var(--color-text-primary)]">
              {item.itemDescription}
            </span>

            <div className="flex items-center gap-2">
              {statusOptions.map((option) => {
                const isActive = item.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateItem(item.itemId, { status: option.value })}
                    className={`flex h-[40px] flex-1 items-center justify-center rounded-[10px] border text-[13px] font-semibold transition-all active:scale-[0.98] ${
                      isActive
                        ? "border-transparent bg-[var(--color-primary)] text-white shadow-xs"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Input
              label="Observações do item (opcional)"
              placeholder="Ex.: aguardando peça do fornecedor"
              value={item.notes}
              maxLength={1000}
              onChange={(event) => updateItem(item.itemId, { notes: event.target.value })}
            />
          </Card>
        ))}

        <Button
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          onClick={() => void handleSubmit()}
          className="mt-2 h-[52px]"
        >
          Salvar progresso
        </Button>
      </div>

      <MobileBottomNav />
    </main>
  );
}
