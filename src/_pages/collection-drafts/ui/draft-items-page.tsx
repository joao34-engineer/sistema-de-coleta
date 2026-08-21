"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  fetchDraftWithItemsAction,
  addItemToDraftAction,
  updateItemInDraftAction,
  removeItemFromDraftAction,
} from "../api/actions";
import type { DraftDTO, DraftItemDTO } from "../model/draft";
import { EditItemModal } from "./edit-item-modal";

type Props = Readonly<{
  draftId: string;
  initialDraft?: DraftDTO | undefined;
  initialItems?: readonly DraftItemDTO[] | undefined;
}>;

export function DraftItemsPage({ draftId, initialDraft, initialItems }: Props) {
  const router = useRouter();
  const [, setDraft] = useState<DraftDTO | null>(initialDraft ?? null);
  const [items, setItems] = useState<readonly DraftItemDTO[]>(initialItems ?? []);
  const [rowVersion, setRowVersion] = useState<number>(initialDraft?.rowVersion ?? 1);

  const [editingItem, setEditingItem] = useState<DraftItemDTO | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

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

  const handleSaveEditedItem = async (updatedData: {
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }) => {
    if (editingItem) {
      const res = await updateItemInDraftAction({
        collectionId: draftId,
        itemId: editingItem.id,
        expectedVersion: rowVersion,
        ...updatedData,
      });

      if (res.ok) {
        setItems((prev) => prev.map((it) => (it.id === editingItem.id ? res.item : it)));
        setDraft(res.draft);
        setRowVersion(res.rowVersion);
        setEditingItem(null);
      }
    } else if (isAddingNew) {
      const res = await addItemToDraftAction({
        collectionId: draftId,
        expectedVersion: rowVersion,
        ...updatedData,
      });

      if (res.ok) {
        setItems((prev) => [...prev, res.item]);
        setDraft(res.draft);
        setRowVersion(res.rowVersion);
        setIsAddingNew(false);
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const res = await removeItemFromDraftAction({
      collectionId: draftId,
      itemId,
      expectedVersion: rowVersion,
    });

    if (res.ok) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setDraft(res.draft);
      setRowVersion(res.rowVersion);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]">Carregando itens...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Itens da coleta"
        subtitle={`Etapa 2 de 3 · ${items.length} itens`}
        backHref={"/coletas/nova" as Route}
      />

      {/* Progress Bar (M03 Node 13:48: 2 de 3 ativas) */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-primary)]" />
          <div className="h-1 w-12 rounded-full bg-[var(--color-border)]" />
        </div>
        <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
          2 de 3
        </span>
      </div>

      <div className="flex flex-col gap-6 px-6 pt-6">
        <div>
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Registre tudo o que foi entregue.
          </h2>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3.5 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {/* Lista de Cards Fiel ao Figma Node 13:48 */}
        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
            const seqNum = String(index + 1).padStart(2, "0");
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
                      {seqNum}
                    </span>
                    <Badge status="ready">{item.condition ?? "Usado"}</Badge>
                  </div>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                    {item.description}
                  </h3>
                  <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
                    {item.quantity} un. · {item.notes || "Foto opcional"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="text-[11px] font-semibold text-[var(--color-primary-strong)] hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-[11px] font-semibold text-[#ba5b52] hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botão Secundário + Adicionar item (Node 13:48) */}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsAddingNew(true)}
          className="h-[52px] rounded-[12px] text-[14px] font-semibold"
        >
          + Adicionar item
        </Button>

        {/* Botão Primário Revisar coleta (Node 13:48) */}
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push(`/coletas/${draftId}/revisao` as Route)}
          className="mt-2 h-[52px] rounded-[12px] text-[14px] font-semibold"
          disabled={items.length === 0}
        >
          Revisar coleta
        </Button>
      </div>

      {(editingItem || isAddingNew) && (
        <EditItemModal
          isOpen={Boolean(editingItem || isAddingNew)}
          item={editingItem ?? undefined}
          onClose={() => {
            setEditingItem(null);
            setIsAddingNew(false);
          }}
          onSave={handleSaveEditedItem}
        />
      )}

      <MobileBottomNav />
    </main>
  );
}

