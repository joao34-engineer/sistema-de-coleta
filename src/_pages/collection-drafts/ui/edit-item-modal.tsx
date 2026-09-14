"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { DraftItemDTO } from "../model/draft";

interface EditItemModalProps {
  readonly item?: DraftItemDTO | undefined;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (updated: {
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
  }) => Promise<void>;
}

const CONDITIONS: readonly { id: string; label: string }[] = [
  { id: "Novo", label: "Novo" },
  { id: "Usado", label: "Usado" },
  { id: "Com Avaria", label: "Com Avaria" },
  { id: "Para Manutenção", label: "Para Manutenção" },
];

export function EditItemModal({ item, isOpen, onClose, onSave }: EditItemModalProps) {
  const [description, setDescription] = useState(item?.description ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [condition, setCondition] = useState<string | null>(item?.condition ?? "Usado");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("A descrição do item é obrigatória.");
      return;
    }
    if (quantity < 1) {
      setError("A quantidade deve ser de pelo menos 1.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        description: description.trim(),
        quantity,
        condition,
        notes: notes.trim() ? notes.trim() : null,
      });
      onClose();
    } catch {
      setError("Falha ao salvar as alterações do item.");
    } finally {
      setIsSaving(false);
    }
  }

  const conditionLabel = (condition ?? "Usado").toLowerCase();

  return (
    <div
      aria-label="Modal de edição de item"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-0 sm:p-4"
      role="dialog"
    >
      <div className="w-full max-w-[390px] rounded-t-2xl bg-[var(--color-surface-bg)] p-6 pb-8 shadow-2xl sm:rounded-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-semibold leading-8 text-[var(--color-text-primary)]">
              {item ? "Editar item" : "Adicionar item"}
            </h3>
            <p className="text-[12px] font-normal text-[var(--color-text-muted)]">Foto opcional</p>
          </div>
          <button
            aria-label="Fechar modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-neutral)]"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <h2 className="mb-4 text-[20px] font-semibold leading-8 text-[var(--color-text-primary)]">
          Descreva o item recebido.
        </h2>

        {error ? (
          <div className="mb-4 rounded-[12px] bg-[#fdf2f1] p-3 text-[12px] font-medium text-[#ba5b52]">{error}</div>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="w-full max-w-[342px] rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-4">
            <Input
              label="Descrição *"
              placeholder="Ex.: Máquina de costura"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Condição: {conditionLabel}</p>
          </div>

          <div className="flex min-h-[132px] w-full max-w-[342px] flex-col rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
            <label className="text-[12px] font-semibold text-[var(--color-text-muted)]" htmlFor="item-notes">
              Observação
            </label>
            <textarea
              id="item-notes"
              className="mt-2 min-h-[72px] w-full resize-none bg-transparent text-[13px] text-[var(--color-text-primary)] focus:outline-none"
              placeholder="Sem danos visíveis"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div>
            <span className="mb-2 block text-[12px] font-semibold text-[var(--color-text-muted)]">Quantidade *</span>
            <div className="flex items-center gap-3">
              <button
                aria-label="Diminuir quantidade"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-xl font-bold text-[var(--color-text-primary)] active:scale-95"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                type="button"
              >
                -
              </button>
              <span className="min-w-[40px] text-center text-lg font-semibold text-[var(--color-text-primary)]">
                {quantity}
              </span>
              <button
                aria-label="Aumentar quantidade"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-neutral)] text-xl font-bold text-[var(--color-text-primary)] active:scale-95"
                onClick={() => setQuantity((q) => q + 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[12px] font-semibold text-[var(--color-text-muted)]">Condição</span>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((cond) => {
                const isSelected = condition === cond.id;
                return (
                  <button
                    key={cond.id}
                    className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-neutral)]"
                    }`}
                    onClick={() => setCondition(isSelected ? null : cond.id)}
                    type="button"
                  >
                    {cond.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="mt-2 h-[52px] max-w-[342px]" isLoading={isSaving} type="submit" variant="primary">
            Salvar item
          </Button>
          <Button className="h-[52px] max-w-[342px]" disabled={isSaving} type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </form>
      </div>
    </div>
  );
}
