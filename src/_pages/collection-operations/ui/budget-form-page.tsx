"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";

export interface BudgetItemState {
  itemId: string;
  itemDescription: string;
  laborCostBrl: number;
  partsCostBrl: number;
  estimatedDays: number;
  notes: string;
}

export interface BudgetFormProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
  }>;
}

export function BudgetFormPage({ collectionId, officialCode, expectedVersion, items }: BudgetFormProps) {
  const [budgetItems, setBudgetItems] = useState<BudgetItemState[]>(
    items.map((it) => ({
      itemId: it.id,
      itemDescription: it.description,
      laborCostBrl: 0,
      partsCostBrl: 0,
      estimatedDays: 3,
      notes: "",
    }))
  );
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleItemChange = <K extends keyof BudgetItemState>(index: number, field: K, value: BudgetItemState[K]) => {
    setBudgetItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, [field]: value };
      }
      return updated;
    });
  };

  const calculateItemTotal = (labor: number, parts: number) => labor + parts;

  const totalBudgetBrl = budgetItems.reduce(
    (sum, item) => sum + calculateItemTotal(item.laborCostBrl, item.partsCostBrl),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
    }, 600);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] text-2xl font-bold border border-[var(--color-primary)]">
          💰
        </div>
        <h1 className="text-xl font-bold text-gray-900">Orçamento Técnico Gerado!</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Valor Total Calculado:{" "}
          <strong className="text-gray-900 text-sm">
            {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
        </p>
        <Link href={`/coletas/${collectionId}/aprovacao`}>
          <Button variant="primary" className="w-full text-xs h-11">
            Ir para Tela de Aprovação do Cliente →
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-24">
      <div>
        <Link href={`/coletas/${collectionId}/operacao`} className="text-xs text-[var(--color-primary)] font-medium hover:underline">
          ← Voltar para Painel Operacional
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Orçamento Técnico</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Detalhamento financeiro em BRL para a coleta {officialCode ?? collectionId}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        {/* Total Budget Card Header */}
        <Card className="border-[var(--color-primary)] bg-[var(--color-surface-green)]">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-primary-strong)] font-medium uppercase tracking-wide">Valor Total do Orçamento</p>
              <p className="text-2xl font-extrabold text-gray-900">
                {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--color-primary-strong)] bg-white px-3 py-1 rounded-full border border-[var(--color-primary)]">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </CardContent>
        </Card>

        {/* Item by Item Budget */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Custos por Equipamento</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((it, idx) => {
              const currentBudgetItem = budgetItems[idx];
              if (!currentBudgetItem) return null;

              const itemTotal = calculateItemTotal(currentBudgetItem.laborCostBrl, currentBudgetItem.partsCostBrl);
              return (
                <div key={it.id} className="rounded-xl border border-[var(--color-border)] p-3.5 space-y-3 bg-white text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900">Item #{idx + 1}: {it.description}</p>
                    <span className="font-bold text-[var(--color-primary-strong)]">
                      Subtotal: {itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Mão de Obra (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentBudgetItem.laborCostBrl}
                        onChange={(e) => handleItemChange(idx, "laborCostBrl", Number(e.target.value))}
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Peças / Insumos (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentBudgetItem.partsCostBrl}
                        onChange={(e) => handleItemChange(idx, "partsCostBrl", Number(e.target.value))}
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Prazo Estimado (Dias)</label>
                      <input
                        type="number"
                        min="1"
                        value={currentBudgetItem.estimatedDays}
                        onChange={(e) => handleItemChange(idx, "estimatedDays", Number(e.target.value))}
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-gray-600">Observações Técnicas</label>
                      <input
                        type="text"
                        value={currentBudgetItem.notes}
                        onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                        placeholder="Substituição de rolamento..."
                        className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* General Notes */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Observações Gerais do Orçamento</h2>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Condições de pagamento, prazos de garantia..."
              className="w-full rounded-xl border border-[var(--color-border)] p-3 text-xs"
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full text-xs h-11 rounded-xl font-semibold"
        >
          Salvar & Enviar para Aprovação
        </Button>
      </form>
    </div>
  );
}
