"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
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
  in_service: "Em Reparo",
  ready: "Pronto",
  invoiced: "Faturada",
  partial_delivery: "Entrega Parcial",
  delivered: "Entregue",
  rejected: "Não Aprovada",
  canceled: "Cancelada",
  reopened: "Reaberta",
};

export function OperationalDetailPage({ collection }: OperationalDetailProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title={collection.officialCode ?? "Guia de Coleta"}
        subtitle={`${collection.items.length} itens · ${statusLabels[collection.status] ?? collection.status}`}
        backHref={"/coletas" as Route}
        badge={
          <Badge status={collection.status}>
            {statusLabels[collection.status] ?? collection.status}
          </Badge>
        }
      />

      <div className="flex flex-col gap-4 px-4">
        {/* Customer Info Card */}
        <div>
          <h2 className="text-[24px] font-semibold text-[var(--color-text)]">
            {collection.customerName ?? "Cliente não informado"}
          </h2>
          <p className="text-[12px] text-[var(--color-muted)]">
            CPF/CNPJ: {collection.customerTaxId ?? "Não informado"}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Local & Data da Coleta
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-[12px] text-[var(--color-muted)]">
            <p><strong>Local:</strong> {collection.locationDescription ?? "Endereço cadastrado"}</p>
            <p><strong>Data:</strong> {collection.collectedAt ? new Date(collection.collectedAt).toLocaleDateString("pt-BR") : "Pendente"}</p>
          </CardContent>
        </Card>

        {/* Operational Actions Menu */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Ações Operacionais da Oficina
            </h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Link href={`/coletas/${collection.id}/oficina/entrada` as Route}>
              <Button variant="secondary" size="sm" className="min-h-[44px] text-[12px]">
                📥 Entrada Oficina
              </Button>
            </Link>
            <Link href={`/coletas/${collection.id}/orcamento` as Route}>
              <Button variant="secondary" size="sm" className="min-h-[44px] text-[12px]">
                💰 Criar Orçamento
              </Button>
            </Link>
            <Link href={`/coletas/${collection.id}/aprovacao` as Route}>
              <Button variant="secondary" size="sm" className="min-h-[44px] text-[12px]">
                ✅ Aprovação
              </Button>
            </Link>
            <Link href={`/coletas/${collection.id}/servico` as Route}>
              <Button variant="secondary" size="sm" className="min-h-[44px] text-[12px]">
                🛠️ Reparo
              </Button>
            </Link>
            <Link href={`/coletas/${collection.id}/faturamento` as Route}>
              <Button variant="secondary" size="sm" className="min-h-[44px] text-[12px]">
                🧾 Faturamento
              </Button>
            </Link>
            <Link href={`/coletas/${collection.id}/entrega` as Route}>
              <Button variant="primary" size="sm" className="min-h-[44px] text-[12px]">
                📦 Entregar
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Items Section */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
              Equipamentos na Coleta ({collection.items.length})
            </h3>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {collection.items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-[12px] border border-[var(--color-border)] p-3 text-[12px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text)]">
                    Item #{index + 1} — {item.quantity}x {item.description}
                  </span>
                  <Link
                    href={`/coletas/${collection.id}/itens/${item.id}/ciclo` as Route}
                    className="text-[12px] font-semibold text-[var(--color-primary-strong)] hover:underline"
                  >
                    Ver Ciclo →
                  </Link>
                </div>
                {item.condition && (
                  <p className="text-[12px] text-[var(--color-muted)]">
                    Condição: {item.condition}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cancellation Trigger */}
        <div className="pt-1">
          <Button
            variant="danger"
            size="md"
            onClick={() => setShowCancelModal(true)}
          >
            {collection.status === "canceled" ? "🔄 Reabrir Coleta" : "⚠️ Cancelar Coleta"}
          </Button>
        </div>
      </div>

      {showCancelModal && (
        <CancelReopenModal
          collectionId={collection.id}
          currentStatus={collection.status}
          expectedVersion={collection.rowVersion}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      <MobileBottomNav />
    </main>
  );
}
