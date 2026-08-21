"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
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

const CONDITION_OPTIONS = [
  { label: "Novo / Sem uso", value: "Novo" },
  { label: "Usado (Normal)", value: "Usado" },
  { label: "Com Avaria / Trinca", value: "Com Avaria" },
  { label: "Para Manutenção", value: "Para Manutenção" },
] as const;

export function DraftItemsPage({ draftId, initialDraft, initialItems }: Props) {
  const router = useRouter();
  const [, setDraft] = useState<DraftDTO | null>(initialDraft ?? null);
  const [items, setItems] = useState<readonly DraftItemDTO[]>(initialItems ?? []);
  const [rowVersion, setRowVersion] = useState<number>(initialDraft?.rowVersion ?? 1);

  // Formulário de Novo Item
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<string>("Usado");
  const [notes, setNotes] = useState("");

  // Estado do Modal de Edição
  const [editingItem, setEditingItem] = useState<DraftItemDTO | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(!initialDraft);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDraft) {
      fetchDraftWithItemsAction(draftId).then((res) => {
        setIsLoading(false);
        if (res.ok && res.draft) {
          setDraft(res.draft);
          setItems(res.items ?? []);
          setRowVersion(res.draft.rowVersion);
        } else {
          setErrorMsg("Rascunho de coleta não encontrado ou inativo.");
        }
      });
    }
  }, [draftId, initialDraft]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg("Informe a descrição do equipamento/item.");
      return;
    }
    if (quantity < 1) {
      setErrorMsg("A quantidade deve ser maior ou igual a 1.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsAdding(true);

    const res = await addItemToDraftAction({
      collectionId: draftId,
      expectedVersion: rowVersion,
      description: description.trim(),
      quantity,
      condition: condition || null,
      notes: notes.trim() || null,
    });

    setIsAdding(false);

    if (!res.ok) {
      if (res.error === "stale_version") {
        setErrorMsg("O rascunho foi alterado por outro dispositivo. Recarregando...");
        const refreshed = await fetchDraftWithItemsAction(draftId);
        if (refreshed.ok && refreshed.draft) {
          setDraft(refreshed.draft);
          setItems(refreshed.items ?? []);
          setRowVersion(refreshed.draft.rowVersion);
        }
      } else {
        setErrorMsg(`Erro ao adicionar item: ${res.error}`);
      }
      return;
    }

    setItems((prev) => [...prev, res.item]);
    setDraft(res.draft);
    setRowVersion(res.rowVersion);

    // Reset Form
    setDescription("");
    setQuantity(1);
    setNotes("");
    setSuccessMsg("Item adicionado com sucesso!");

    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveEditedItem = async (updatedData: {
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }) => {
    if (!editingItem) return;

    const res = await updateItemInDraftAction({
      collectionId: draftId,
      itemId: editingItem.id,
      expectedVersion: rowVersion,
      ...updatedData,
    });

    if (!res.ok) {
      if (res.error === "stale_version") {
        const refreshed = await fetchDraftWithItemsAction(draftId);
        if (refreshed.ok && refreshed.draft) {
          setDraft(refreshed.draft);
          setItems(refreshed.items ?? []);
          setRowVersion(refreshed.draft.rowVersion);
        }
      }
      throw new Error(res.error);
    }

    setItems((prev) => prev.map((it) => (it.id === editingItem.id ? res.item : it)));
    setDraft(res.draft);
    setRowVersion(res.rowVersion);
    setEditingItem(null);
  };

  const handleRemoveItem = async (itemId: string) => {
    setErrorMsg(null);
    setRemovingId(itemId);

    const res = await removeItemFromDraftAction({
      collectionId: draftId,
      itemId,
      expectedVersion: rowVersion,
    });

    setRemovingId(null);

    if (!res.ok) {
      setErrorMsg(`Erro ao remover item: ${res.error}`);
      return;
    }

    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setDraft(res.draft);
    setRowVersion(res.rowVersion);
  };

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center">
        <p className="text-[14px] text-[var(--color-muted)]">Carregando itens da coleta...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Itens da coleta"
        subtitle="Passo 2 de 4"
        backHref={"/coletas/nova" as Route}
      />

      <div className="flex flex-col gap-5 px-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[var(--color-text)]">
            Adicione ao menos um item.
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Rascunho #{draftId.substring(0, 8)} · v{rowVersion}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[12px] border border-[#fca5a5] bg-[#fdf2f1] p-3 text-[12px] font-semibold text-[#ba5b52]">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-[12px] border border-[#4c916f] bg-[#eef8f2] p-3 text-[12px] font-semibold text-[#31674c]">
            {successMsg}
          </div>
        )}

        {/* Formulário de Adição de Item */}
        <form onSubmit={handleAddItem}>
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                + Adicionar Equipamento
              </h3>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                label="Descrição do Equipamento *"
                placeholder="Ex: Máquina de costura ou Turbina T3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              {/* Controle de Quantidade Touch */}
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[var(--color-muted)]">
                  Quantidade *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-lg font-bold text-[var(--color-text)]"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-base font-bold text-[var(--color-text)]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-lg font-bold text-[var(--color-text)]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Chips de Condição */}
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-muted)]">
                  Condição Física do Item
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITION_OPTIONS.map((opt) => {
                    const isSelected = condition === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCondition(opt.value)}
                        className={`flex min-h-[44px] items-center justify-center rounded-[12px] border text-[12px] font-semibold transition-colors ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-[var(--color-surface-green)] text-[var(--color-primary-strong)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Observações / Foto opcional"
                placeholder="Ex: Folga no eixo ou marcas de vazamento"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isAdding}
                size="md"
              >
                + Adicionar Item à Coleta
              </Button>
            </CardFooter>
          </Card>
        </form>

        {/* Lista de Itens Já Adicionados */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
                Itens na Coleta ({items.length})
              </h3>
              {items.length > 0 && <Badge status="collected">{items.length} salvos</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="py-6 text-center">
                <span className="text-3xl">📦</span>
                <p className="mt-2 text-[12px] font-semibold text-[var(--color-muted)]">
                  Nenhum item adicionado ainda.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-[12px] border border-[var(--color-border)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-[var(--color-text)]">
                            {item.quantity}x {item.description}
                          </span>
                          {item.condition && (
                            <Badge status="ready">{item.condition}</Badge>
                          )}
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                          className="text-[12px] text-[var(--color-primary-strong)]"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={removingId === item.id}
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-[12px] text-[#ba5b52]"
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          {items.length > 0 && (
            <CardFooter className="pt-3">
              <Button
                variant="primary"
                onClick={() => router.push(`/coletas/${draftId}/revisao` as Route)}
                size="md"
              >
                Avançar para Revisão →
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {editingItem && (
        <EditItemModal
          isOpen={Boolean(editingItem)}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEditedItem}
        />
      )}

      <MobileBottomNav />
    </main>
  );
}
