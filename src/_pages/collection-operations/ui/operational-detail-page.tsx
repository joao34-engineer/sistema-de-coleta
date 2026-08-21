"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { CancelReopenModal } from "./cancel-reopen-modal";

export interface OperationalDetailProps {
  collection: {
    id: string;
    officialCode: string | null;
    status:
      | "draft"
      | "collected"
      | "canceled"
      | "in_service"
      | "ready"
      | "in_workshop"
      | "in_budget"
      | "awaiting_approval"
      | "approved"
      | "invoiced"
      | "partial_delivery"
      | "delivered"
      | "rejected"
      | "reopened";
    rowVersion: number;
    customerName: string | null;
    customerTaxId: string | null;
    collectedAt: string | null;
    locationDescription: string | null;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      condition: string | null;
      notes: string | null;
    }>;
    events: Array<{
      id: string;
      type: string;
      previousStatus: string | null;
      nextStatus: string | null;
      reason: string | null;
      actorName: string | null;
      createdAt: string;
    }>;
  };
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  collected: "Coletada",
  in_workshop: "Em Oficina",
  in_budget: "Em Orçamento",
  awaiting_approval: "Aguardando Aprovação",
  approved: "Aprovada",
  in_service: "Em Manutenção",
  ready: "Pronto para Entrega",
  invoiced: "Faturada (NF-e)",
  partial_delivery: "Entrega Parcial",
  delivered: "Entregue",
  rejected: "Não Aprovada",
  canceled: "Cancelada",
  reopened: "Reaberta",
};

export function OperationalDetailPage({ collection }: OperationalDetailProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/coletas" className="text-xs text-[var(--color-primary)] font-medium hover:underline">
            ← Voltar para lista
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {collection.officialCode ?? "Coleta Rascunho"}
          </h1>
          <p className="text-xs text-[var(--color-muted)]">
            ID: {collection.id.slice(0, 8)}... • Versão {collection.rowVersion}
          </p>
        </div>
        <Badge status={collection.status}>
          {statusLabels[collection.status] ?? collection.status}
        </Badge>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Dados do Cliente & Local</h2>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-gray-800">
          <p><strong className="text-gray-600">Cliente:</strong> {collection.customerName ?? "Não informado"}</p>
          <p><strong className="text-gray-600">CPF/CNPJ:</strong> {collection.customerTaxId ?? "Não informado"}</p>
          <p><strong className="text-gray-600">Local:</strong> {collection.locationDescription ?? "Local da Coleta MJT"}</p>
          <p><strong className="text-gray-600">Data de Coleta:</strong> {collection.collectedAt ? new Date(collection.collectedAt).toLocaleDateString("pt-BR") : "Pendente"}</p>
        </CardContent>
      </Card>

      {/* Operational Actions Menu */}
      <Card className="border-[var(--color-primary)]/30 bg-[var(--color-surface-green)]/30">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-bold text-[var(--color-primary-strong)]">Ações Operacionais da Oficina</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Link href={`/coletas/${collection.id}/oficina/entrada`}>
            <Button variant="secondary" className="w-full text-xs h-10 bg-white">
              📥 Entrada Oficina
            </Button>
          </Link>
          <Link href={`/coletas/${collection.id}/orcamento`}>
            <Button variant="secondary" className="w-full text-xs h-10 bg-white">
              💰 Criar Orçamento
            </Button>
          </Link>
          <Link href={`/coletas/${collection.id}/aprovacao`}>
            <Button variant="secondary" className="w-full text-xs h-10 bg-white">
              ✅ Aprovação Cliente
            </Button>
          </Link>
          <Link href={`/coletas/${collection.id}/servico`}>
            <Button variant="secondary" className="w-full text-xs h-10 bg-white">
              🛠️ Manutenção
            </Button>
          </Link>
          <Link href={`/coletas/${collection.id}/faturamento`}>
            <Button variant="secondary" className="w-full text-xs h-10 bg-white">
              🧾 Faturamento NF-e
            </Button>
          </Link>
          <Link href={`/coletas/${collection.id}/entrega`}>
            <Button variant="primary" className="w-full text-xs h-10">
              📦 Entregar ao Cliente
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Equipamentos ({collection.items.length})</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {collection.items.map((item, index) => (
            <div key={item.id} className="rounded-xl border border-[var(--color-border)] p-3 space-y-1.5 text-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Item #{index + 1} — Qtd: {item.quantity}</span>
                <Link href={`/coletas/${collection.id}/itens/${item.id}/ciclo`} className="text-[var(--color-primary)] font-medium hover:underline">
                  Ver Ciclo →
                </Link>
              </div>
              <p className="text-gray-800">{item.description}</p>
              {item.condition && <p className="text-gray-500"><strong>Condição:</strong> {item.condition}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cancellation / Reopen Trigger Button */}
      <div className="pt-2">
        <Button
          variant="danger"
          className="w-full text-xs h-11"
          onClick={() => setShowCancelModal(true)}
        >
          {collection.status === "canceled" ? "🔄 Reabrir Coleta Cancelada" : "⚠️ Cancelar ou Alterar Status da Coleta"}
        </Button>
      </div>

      {/* Event Timeline (Append-Only) */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-gray-700">Timeline de Eventos Auditados</h2>
        </CardHeader>
        <CardContent>
          {collection.events.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">Nenhum evento registrado até o momento.</p>
          ) : (
            <div className="relative border-l-2 border-[var(--color-border)] pl-4 space-y-4 text-xs">
              {collection.events.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className="absolute -left-[21px] top-0 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                  <p className="font-semibold text-gray-900">{evt.type}</p>
                  <p className="text-gray-600">
                    {evt.previousStatus ?? "N/A"} → <span className="font-medium text-[var(--color-primary-strong)]">{evt.nextStatus ?? "N/A"}</span>
                  </p>
                  {evt.reason && <p className="mt-0.5 text-gray-500 italic">Motivo: &quot;{evt.reason}&quot;</p>}
                  <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                    Por {evt.actorName ?? "Sistema"} em {new Date(evt.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showCancelModal && (
        <CancelReopenModal
          collectionId={collection.id}
          currentStatus={collection.status}
          expectedVersion={collection.rowVersion}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
