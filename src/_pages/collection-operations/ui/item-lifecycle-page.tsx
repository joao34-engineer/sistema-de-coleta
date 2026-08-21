"use client";

import Link from "next/link";
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
  ready: "Pronto para Entrega",
  delivered: "Entregue ao Cliente",
  canceled: "Cancelado",
};

export function ItemLifecyclePage({ collectionId, officialCode, item, events }: ItemLifecycleProps) {
  const itemTotalBrl = (item.laborCostBrl ?? 0) + (item.partsCostBrl ?? 0);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-24">
      <div>
        <Link href={`/coletas/${collectionId}/operacao`} className="text-xs text-[var(--color-primary)] font-medium hover:underline">
          ← Voltar para Coleta {officialCode ?? collectionId}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Ciclo de Vida do Equipamento</h1>
        <p className="text-xs text-[var(--color-muted)]">Rastreabilidade individual por item (M16)</p>
      </div>

      {/* Item Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Detalhes do Item</h2>
          <Badge status={item.status === "delivered" ? "ready" : item.status === "in_service" ? "in_service" : "neutral"}>
            {itemStatusLabels[item.status] ?? item.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-gray-800">
          <p className="font-bold text-sm text-gray-900">{item.description}</p>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <p><strong>Quantidade:</strong> {item.quantity}</p>
            <p><strong>Condição Inicial:</strong> {item.condition ?? "Normal"}</p>
          </div>
          {itemTotalBrl > 0 && (
            <p className="text-[var(--color-primary-strong)] font-semibold">
              Custo do Reparo: {itemTotalBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          )}
          {item.notes && <p className="text-gray-500 italic">Notas: &quot;{item.notes}&quot;</p>}
        </CardContent>
      </Card>

      {/* Item Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Timeline de Eventos do Item</h2>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="space-y-3 border-l-2 border-[var(--color-primary)] pl-4 text-xs">
              <div>
                <p className="font-semibold text-gray-900">Coleta Registrada</p>
                <p className="text-gray-500">Item inserido no rascunho oficial da coleta {officialCode ?? collectionId}.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Entrada na Oficina MJT</p>
                <p className="text-gray-500">Item recebido e verificado pelo administrador da oficina.</p>
              </div>
            </div>
          ) : (
            <div className="relative border-l-2 border-[var(--color-primary)] pl-4 space-y-4 text-xs">
              {events.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className="absolute -left-[21px] top-0 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                  <p className="font-semibold text-gray-900">{evt.eventType}</p>
                  <p className="text-gray-600">{evt.description}</p>
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
  );
}
