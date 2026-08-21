"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
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

  const readyCount = itemStatuses.filter((i) => i.status === "pronto").length;

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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef8f2] text-[#31674c] text-2xl font-bold border border-[#4c916f]">
          🛠️
        </div>
        <h2 className="mt-4 text-[20px] font-semibold text-[var(--color-text)]">
          Manutenção Atualizada!
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          {readyCount} de {items.length} itens marcados como prontos.
        </p>
        <div className="mt-6 w-full">
          <Link href={`/coletas/${collectionId}/operacao` as Route}>
            <Button variant="primary" size="md">
              Voltar ao Painel Operacional
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Em reparo"
        subtitle="Atualização interna"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
        <input type="hidden" name="expectedVersion" value={expectedVersion} />

        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            Manutenção do equipamento
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId}
          </p>
        </div>

        {/* Detalhamento do Reparo do Figma M14 */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Detalhamento da Execução
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Diagnóstico
              </span>
              <p className="text-[14px] text-[var(--color-text)]">
                Troca de correia dentada e alinhamento
              </p>
            </div>

            <div>
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Peça trocada
              </span>
              <p className="text-[14px] text-[var(--color-text)]">
                Correia Gates 4PK850
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                  Mão de obra
                </span>
                <p className="text-[14px] text-[var(--color-text)]">
                  1h 30min
                </p>
              </div>
              <div>
                <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                  Status atual
                </span>
                <Badge status="in_service">Em Reparo</Badge>
              </div>
            </div>

            <div>
              <span className="text-[12px] font-semibold text-[var(--color-muted)]">
                Observação técnica
              </span>
              <p className="text-[14px] text-[var(--color-text)]">
                Teste final em bancada pendente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* List of Items with Quick Ready Action */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Ação Rápida no Item
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {items.map((it, idx) => {
              const currentItem = itemStatuses[idx];
              if (!currentItem) return null;
              const currentStatus = currentItem.status;
              return (
                <div
                  key={it.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-[var(--color-border)] p-3 text-[12px]"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--color-text)]">
                      {it.description}
                    </p>
                    <Badge status={currentStatus === "pronto" ? "ready" : "in_service"}>
                      {currentStatus === "pronto" ? "Pronto" : "Em Reparo"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleStatusToggle(idx, "em_reparo")}
                      className={`min-h-[44px] rounded-[10px] text-[12px] font-semibold transition-colors ${
                        currentStatus === "em_reparo"
                          ? "bg-[#fff8ec] text-[#a36b2c] border border-[#fcd34d]"
                          : "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]"
                      }`}
                    >
                      Em Reparo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusToggle(idx, "pronto")}
                      className={`min-h-[44px] rounded-[10px] text-[12px] font-semibold transition-colors ${
                        currentStatus === "pronto"
                          ? "bg-[#eef8f2] text-[#31674c] border border-[#4c916f]"
                          : "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]"
                      }`}
                    >
                      Marcar Pronto
                    </button>
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
          size="md"
        >
          Marcar como pronto
        </Button>
      </form>

      <MobileBottomNav />
    </main>
  );
}
