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

  return (
    <div
      aria-label="Modal de edição de item"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-0 sm:p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--color-card-bg,#ffffff)] p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between border-b border-[var(--color-border,#dee4e0)] pb-3 mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary,#111827)]">
            Editar Equipamento
          </h3>
          <button
            aria-label="Fechar modal"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-[var(--color-surface-neutral,#eff2f0)]"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
              Descrição do Equipamento *
            </label>
            <Input
              placeholder="Ex: Motor Elétrico WEG 50CV"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
              Quantidade *
            </label>
            <div className="flex items-center space-x-3">
              <button
                aria-label="Diminuir quantidade"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border,#dee4e0)] bg-[var(--color-surface-neutral,#eff2f0)] text-xl font-bold text-[var(--color-text-primary,#111827)] active:scale-95"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                type="button"
              >
                -
              </button>
              <span className="min-w-[40px] text-center text-lg font-semibold text-[var(--color-text-primary,#111827)]">
                {quantity}
              </span>
              <button
                aria-label="Aumentar quantidade"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border,#dee4e0)] bg-[var(--color-surface-neutral,#eff2f0)] text-xl font-bold text-[var(--color-text-primary,#111827)] active:scale-95"
                onClick={() => setQuantity((q) => q + 1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-2">
              Condição do Equipamento
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((cond) => {
                const isSelected = condition === cond.id;
                return (
                  <button
                    key={cond.id}
                    className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[var(--color-primary,#4c916f)] text-white shadow-sm"
                        : "border border-[var(--color-border,#dee4e0)] bg-white text-[var(--color-text-primary,#111827)] hover:bg-[var(--color-surface-neutral,#eff2f0)]"
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

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
              Observações Técnicas / Notas
            </label>
            <textarea
              className="w-full rounded-lg border border-[var(--color-border,#dee4e0)] p-3 text-sm focus:border-[var(--color-primary,#4c916f)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#4c916f)]"
              placeholder="Ex: Apresenta marcas de uso na carcaça superior..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <Button
              className="min-h-[44px] flex-1"
              disabled={isSaving}
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-[44px] flex-1"
              isLoading={isSaving}
              type="submit"
              variant="primary"
            >
              Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
