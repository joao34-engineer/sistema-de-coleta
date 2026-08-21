"use client";

import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Badge } from "@/shared/ui/badge";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";

export interface ItemLifecycleProps {
  collectionId: string;
  officialCode: string | null;
  item: {
    id: string;
    description: string;
    quantity: number;
    condition: string | null;
    notes: string | null;
    laborCostBrl?: number;
    partsCostBrl?: number;
    status: "draft" | "collected" | "in_workshop" | "in_budget" | "in_service" | "ready" | "delivered" | "canceled";
  };
  events: Array<{
    id: string;
    eventType: string;
    description: string;
    actorName: string | null;
    createdAt: string;
  }>;
}

const itemStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  collected: "Coletado",
  in_workshop: "Em Oficina",
  in_budget: "Em Orçamento",
  in_service: "Em Reparo",
  ready: "Pronto",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export function ItemLifecyclePage({ collectionId, officialCode, item, events }: ItemLifecycleProps) {
  const itemTotalBrl = (item.laborCostBrl ?? 0) + (item.partsCostBrl ?? 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Ciclo do item"
        subtitle="Histórico por equipamento"
        backHref={`/coletas/${collectionId}/operacao` as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        <div>
          <h2 className="text-[22px] font-semibold text-[var(--color-text)]">
            {item.description}
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            Guia {officialCode ?? collectionId} · Qtd: {item.quantity}
          </p>
        </div>

        {/* Item Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Detalhes do Item
            </h3>
            <Badge status={item.status === "delivered" ? "ready" : item.status === "in_service" ? "in_service" : "neutral"}>
              {itemStatusLabels[item.status] ?? item.status}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-[12px] text-[var(--color-muted)]">
            <p><strong>Condição Inicial:</strong> {item.condition ?? "Normal"}</p>
            {itemTotalBrl > 0 && (
              <p className="font-semibold text-[var(--color-primary-strong)]">
                Custo do Reparo: {itemTotalBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            )}
            {item.notes && <p className="italic">Notas: &quot;{item.notes}&quot;</p>}
          </CardContent>
        </Card>

        {/* Item Timeline do Figma M16 */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Timeline do Equipamento
            </h3>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="relative border-l-2 border-[var(--color-primary)] pl-4 space-y-4 text-[12px]">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[var(--color-primary)]" />
                  <p className="font-semibold text-[var(--color-text)]">Coleta Registrada</p>
                  <p className="text-[var(--color-muted)]">Item inserido na guia oficial da coleta.</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[var(--color-primary)]" />
                  <p className="font-semibold text-[var(--color-text)]">Entrada na Oficina MJT</p>
                  <p className="text-[var(--color-muted)]">Item recebido na bancada de testes.</p>
                </div>
              </div>
            ) : (
              <div className="relative border-l-2 border-[var(--color-primary)] pl-4 space-y-4 text-[12px]">
                {events.map((evt) => (
                  <div key={evt.id} className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[var(--color-primary)]" />
                    <p className="font-semibold text-[var(--color-text)]">{evt.eventType}</p>
                    <p className="text-[var(--color-muted)]">{evt.description}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                      Por {evt.actorName ?? "Operador"} em {new Date(evt.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav />
    </main>
  );
}
