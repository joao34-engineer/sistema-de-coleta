"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

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
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] px-4 py-12 text-center flex flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-green)] text-[var(--color-primary-strong)] text-2xl font-bold border border-[var(--color-primary)]">
          💰
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          Orçamento Técnico Gerado!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Valor Total Calculado:{" "}
          <strong className="text-[var(--color-text)]">
            {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
        </p>
        <div className="mt-6 w-full">
          <Link href={`/coletas/${collectionId}/aprovacao` as Route}>
            <Button variant="primary" size="md">
              Ir para Aprovação do Cliente →
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Orçamento e reparo"
        subtitle="Uso interno"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            Avaliação do reparo
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId}
          </p>
        </div>

        {/* Total Budget Card Header */}
        <Card className="border-[var(--color-primary)] bg-[var(--color-surface-green)]">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary-strong)]">
                Valor Total do Orçamento
              </p>
              <p className="text-[24px] font-bold text-[var(--color-text)]">
                {totalBudgetBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Item by Item Budget */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Custos por Equipamento
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {items.map((it, idx) => {
              const currentBudgetItem = budgetItems[idx];
              if (!currentBudgetItem) return null;

              const itemTotal = calculateItemTotal(currentBudgetItem.laborCostBrl, currentBudgetItem.partsCostBrl);
              return (
                <div
                  key={it.id}
                  className="flex flex-col gap-3 rounded-[12px] border border-[var(--color-border)] p-3 text-[12px]"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--color-text)]">
                      Item #{idx + 1}: {it.description}
                    </p>
                    <span className="font-semibold text-[var(--color-primary-strong)]">
                      {itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Mão de Obra (R$)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentBudgetItem.laborCostBrl}
                      onChange={(e) => handleItemChange(idx, "laborCostBrl", Number(e.target.value))}
                    />
                    <Input
                      label="Peças / Insumos (R$)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentBudgetItem.partsCostBrl}
                      onChange={(e) => handleItemChange(idx, "partsCostBrl", Number(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Prazo (Dias)"
                      type="number"
                      min="1"
                      value={currentBudgetItem.estimatedDays}
                      onChange={(e) => handleItemChange(idx, "estimatedDays", Number(e.target.value))}
                    />
                    <Input
                      label="Observações"
                      placeholder="Substituição de rolamento..."
                      value={currentBudgetItem.notes}
                      onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* General Notes */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Observações Gerais
            </h3>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Condições de pagamento, prazos de garantia..."
              className="w-full rounded-[12px] border border-[var(--color-border)] p-3 text-[14px] text-[var(--color-text)] placeholder-[var(--color-border-subdued)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          size="md"
        >
          Salvar orçamento
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
