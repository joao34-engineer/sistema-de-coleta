"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export interface ServiceItemState {
  itemId: string;
  itemDescription: string;
  status: "em_reparo" | "pronto";
  notes: string;
}

export interface ServiceProgressProps {
  collectionId: string;
  officialCode: string | null;
  expectedVersion: number;
  items: Array<{
    id: string;
    description: string;
    condition: string | null;
    status: "em_reparo" | "pronto";
    notes?: string | null;
  }>;
}

export function ServiceProgressPage({ collectionId, officialCode, expectedVersion, items }: ServiceProgressProps) {
  const [itemStatuses, setItemStatuses] = useState<ServiceItemState[]>(
    items.map((it) => ({
      itemId: it.id,
      itemDescription: it.description,
      status: it.status,
      notes: it.notes ?? "",
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleStatusToggle = (index: number, newStatus: "em_reparo" | "pronto") => {
    setItemStatuses((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, status: newStatus };
      }
      return updated;
    });
  };

  const handleNotesChange = (index: number, notes: string) => {
    setItemStatuses((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, notes };
      }
      return updated;
    });
  };

  const readyCount = itemStatuses.filter((i) => i.status === "pronto").length;
  const progressPercent = Math.round((readyCount / itemStatuses.length) * 100);

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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-2xl font-bold border border-blue-200">
          🛠️
        </div>
        <h1 className="text-xl font-bold text-gray-900">Status de Manutenção Atualizado!</h1>
        <p className="text-xs text-[var(--color-muted)]">
          {readyCount} de {items.length} itens marcados como prontos ({progressPercent}% concluído).
        </p>
        <Link href={`/coletas/${collectionId}/operacao`}>
          <Button variant="primary" className="w-full text-xs h-11">
            Voltar para Painel Operacional
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
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Manutenção na Oficina</h1>
        <p className="text-xs text-[var(--color-muted)]">
          Acompanhamento dos serviços em execução ({officialCode ?? collectionId})
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        {/* Progress Bar Card */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Progresso dos Reparos</span>
              <span className="font-bold text-[var(--color-primary-strong)]">
                {readyCount} de {items.length} prontos ({progressPercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Item List with Status Toggle */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Status por Equipamento</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => {
              const currentItem = itemStatuses[idx];
              if (!currentItem) return null;
              const currentStatus = currentItem.status;
              return (
                <div key={it.id} className="rounded-xl border border-[var(--color-border)] p-3 space-y-3 bg-white text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900">Item #{idx + 1}: {it.description}</p>
                    <Badge status={currentStatus === "pronto" ? "ready" : "in_service"}>
                      {currentStatus === "pronto" ? "Pronto" : "Em Reparo"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusToggle(idx, "em_reparo")}
                      className={`h-9 rounded-lg font-semibold text-xs border transition-colors ${
                        currentStatus === "em_reparo"
                          ? "bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      🛠️ Em Reparo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusToggle(idx, "pronto")}
                      className={`h-9 rounded-lg font-semibold text-xs border transition-colors ${
                        currentStatus === "pronto"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-300"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      ✓ Concluído / Pronto
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={currentItem.notes}
                      onChange={(e) => handleNotesChange(idx, e.target.value)}
                      placeholder="Observação técnica do serviço (opcional)"
                      className="h-9 w-full rounded-lg border border-[var(--color-border)] px-2.5 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full text-xs h-11 rounded-xl font-semibold"
        >
          Salvar Progresso dos Serviços
        </Button>
      </form>
    </div>
  );
}
