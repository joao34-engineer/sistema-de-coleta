"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
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
  const [draft, setDraft] = useState<DraftDTO | null>(initialDraft ?? null);
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
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-[var(--color-muted)]">Carregando itens da coleta...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
      {/* Top Header Mobile */}
      <header className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <Link href={"/coletas/nova" as Route}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            ← Dados do Cliente
          </Button>
        </Link>
        <div className="text-right">
          <Badge status="draft">M03 · Itens da Coleta</Badge>
          <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">Passo 2 de 4</span>
        </div>
      </header>

      <div className="flex flex-col gap-5">
        {/* Banner de Rascunho Ativo */}
        <Card className="bg-[var(--color-surface-neutral)]">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-muted)] uppercase">
                Rascunho #{draftId.substring(0, 8)}
              </span>
              <Badge status="draft">v{rowVersion} · Autosave Ativo</Badge>
            </div>
            {draft?.collectionLocation && (
              <p className="mt-1 text-xs font-semibold text-[var(--color-text)]">
                📍 Local: {draft.collectionLocation}
              </p>
            )}
          </CardHeader>
        </Card>

        {errorMsg && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
            {successMsg}
          </div>
        )}

        {/* Formulário de Adição de Item */}
        <form onSubmit={handleAddItem}>
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-sm font-bold text-[var(--color-text)]">+ Adicionar Equipamento / Item</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Descreva a peça ou equipamento sendo recolhido.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                label="Descrição do Equipamento *"
                placeholder="Ex: Turbina Master Power T3 ou Bloco do Motor"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              {/* Controle de Quantidade Touch */}
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--color-text)]">
                  Quantidade *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-lg font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-base font-bold text-[var(--color-text)]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-lg font-bold text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Chips de Condição */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[var(--color-text)]">
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
                        className={`flex min-h-[44px] items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-[var(--color-surface-green)] text-[var(--color-primary)] shadow-sm"
                            : "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-muted)] hover:border-[var(--color-primary)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Observações Técnicas / Avarias"
                placeholder="Ex: Folga no eixo, caracol com marcas de vazamento"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={isAdding}
                className="w-full text-sm font-bold"
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
              <h2 className="text-sm font-bold text-[var(--color-text)]">
                Itens na Coleta ({items.length})
              </h2>
              {items.length > 0 && <Badge status="collected">{items.length} itens salvos</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="py-6 text-center">
                <span className="text-3xl">📦</span>
                <p className="mt-2 text-xs font-semibold text-[var(--color-muted)]">
                  Nenhum item adicionado ainda.
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Preencha o formulário acima para registrar as peças.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--color-text)]">
                            {item.quantity}x {item.description}
                          </span>
                          {item.condition && (
                            <Badge status="ready">{item.condition}</Badge>
                          )}
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                          className="text-xs text-[var(--color-primary,#4c916f)] hover:bg-[var(--color-surface-green)]"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={removingId === item.id}
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
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
                className="w-full text-sm font-bold min-h-[44px]"
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
    </main>
  );
}

