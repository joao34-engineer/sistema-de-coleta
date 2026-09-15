"use client";

import { useState } from "react";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/card";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { saveTechnicalBudgetAction } from "../api/actions";
import { useWorkshopHubSubmit } from "../model/use-workshop-hub-submit";

type BudgetItemInput = Readonly<{
  id: string;
  collectionItemId: string;
  itemDescription: string;
  laborCostBrl: number;
  partsCostBrl: number;
  estimatedDays: number;
  notes: string | null;
}>;

type Props = Readonly<{
  collectionId: string;
  officialCode: string | null;
  budgetItems: ReadonlyArray<BudgetItemInput>;
  budgetTotal: number;
  rowVersion: number;
}>;

type EditableBudgetItem = {
  itemId: string;
  itemDescription: string;
  laborCostBrl: string;
  partsCostBrl: string;
  estimatedDays: string;
  notes: string;
};

function parseBrl(value: string): number {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function TechnicalBudgetPage({ collectionId, officialCode, budgetItems, rowVersion }: Props) {
  const [items, setItems] = useState<EditableBudgetItem[]>(() =>
    budgetItems.map((item) => ({
      itemId: item.collectionItemId,
      itemDescription: item.itemDescription,
      laborCostBrl: String(item.laborCostBrl).replace(".", ","),
      partsCostBrl: String(item.partsCostBrl).replace(".", ","),
      estimatedDays: String(item.estimatedDays),
      notes: item.notes ?? "",
    })),
  );
  const [generalNotes, setGeneralNotes] = useState("");
  const { error: errorMsg, isPending, setError, submit } = useWorkshopHubSubmit(collectionId);

  const liveTotal = items.reduce((total, item) => total + parseBrl(item.laborCostBrl) + parseBrl(item.partsCostBrl), 0);

  function updateItem(itemId: string, patch: Partial<Omit<EditableBudgetItem, "itemId">>) {
    setItems((current) => current.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)));
  }

  function handleSubmit() {
    if (items.some((item) => !(Number.parseInt(item.estimatedDays, 10) >= 1))) {
      setError("Informe um prazo de pelo menos 1 dia para todos os itens.");
      return;
    }
    if (items.some((item) => parseBrl(item.laborCostBrl) < 0 || parseBrl(item.partsCostBrl) < 0)) {
      setError("Os valores não podem ser negativos.");
      return;
    }

    submit(async () =>
      saveTechnicalBudgetAction(
        collectionId,
        {
          collectionId,
          expectedVersion: rowVersion,
          items: items.map((item) => ({
            itemId: item.itemId,
            itemDescription: item.itemDescription,
            laborCostBrl: parseBrl(item.laborCostBrl),
            partsCostBrl: parseBrl(item.partsCostBrl),
            estimatedDays: Number.parseInt(item.estimatedDays, 10),
            notes: item.notes.trim() === "" ? null : item.notes.trim(),
          })),
          generalNotes: generalNotes.trim() === "" ? null : generalNotes.trim(),
        },
        crypto.randomUUID(),
      ),
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader
          title="Orçamento técnico"
          subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
          backHref={`/coletas/${collectionId}` as Route}
        />
        <div className="px-6 pt-4">
          <MobileStatePanel
            type="empty"
            title="Nenhum item na coleta"
            subtitle="Não há itens registrados para orçar nesta coleta."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Orçamento técnico"
        subtitle={officialCode ? `Guia ${officialCode}` : "Coleta"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {errorMsg && (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,white)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] p-3.5 text-[12px] font-semibold text-[var(--color-danger)]">
            {errorMsg}
          </div>
        )}

        <h2 className="text-[24px] font-semibold leading-8 text-[var(--color-text-primary)]">Por item</h2>

        {items.map((item) => (
          <Card key={item.itemId} className="flex w-full max-w-[342px] flex-col gap-3 bg-[var(--color-card-bg)]">
            <span className="break-words text-[14px] font-semibold text-[var(--color-text-primary)]">
              {item.itemDescription}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Mão de obra (R$)"
                inputMode="decimal"
                placeholder="0,00"
                value={item.laborCostBrl}
                onChange={(event) => updateItem(item.itemId, { laborCostBrl: event.target.value })}
                disabled={isPending}
              />
              <Input
                label="Peças (R$)"
                inputMode="decimal"
                placeholder="0,00"
                value={item.partsCostBrl}
                onChange={(event) => updateItem(item.itemId, { partsCostBrl: event.target.value })}
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prazo (dias)"
                inputMode="numeric"
                value={item.estimatedDays}
                onChange={(event) => updateItem(item.itemId, { estimatedDays: event.target.value })}
                disabled={isPending}
              />
            </div>
            <Input
              label="Observações do item (opcional)"
              value={item.notes}
              maxLength={1000}
              onChange={(event) => updateItem(item.itemId, { notes: event.target.value })}
              disabled={isPending}
            />
          </Card>
        ))}

        <Card className="flex w-full max-w-[342px] flex-col gap-1 bg-[var(--color-card-bg)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total</span>
          <span className="text-[28px] font-semibold leading-tight text-[var(--color-text-primary)]">{formatBrl(liveTotal)}</span>
        </Card>

        <Input
          label="Observações gerais (opcional)"
          placeholder="Ex.: orçamento válido por 7 dias"
          value={generalNotes}
          maxLength={2000}
          onChange={(event) => setGeneralNotes(event.target.value)}
          disabled={isPending}
        />

        <Button
          variant="primary"
          size="md"
          isLoading={isPending}
          onClick={() => void handleSubmit()}
          className="mt-2 h-[52px]"
        >
          Salvar orçamento
        </Button>
      </div>

    </main>
  );
}
