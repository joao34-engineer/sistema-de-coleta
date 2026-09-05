"use client";

import type { Route } from "next";
import type { CollectionHubView, CollectionEventSummary, ServiceOrder, BudgetItem } from "../model/view-models";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Card } from "@/shared/ui/card";
import { CollectionStatusBadge } from "./collection-status-badge";
import { CollectionTimeline } from "./collection-timeline";
import { OperationalActions } from "./operational-actions";
import { formatDateTimePtBr } from "@/shared/lib/format-date-time-pt-br";

export type CollectionDetailHubProps = Readonly<{
  collection: CollectionHubView;
  events: ReadonlyArray<CollectionEventSummary>;
  serviceOrder: ServiceOrder | null;
  budgetItems: ReadonlyArray<BudgetItem>;
}>;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return formatDateTimePtBr(value);
}

export function CollectionDetailHub({ collection, events, serviceOrder, budgetItems }: CollectionDetailHubProps) {
  const budgetTotal = budgetItems.reduce((total, item) => total + item.laborCostBrl + item.partsCostBrl, 0);

  const collectedAt = formatDate(collection.collectedAt);
  const hasBudget = budgetItems.length > 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title={collection.officialCode ?? "Coleta"}
        subtitle="Detalhe da coleta"
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {/* Status atual */}
        <section className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</span>
            <CollectionStatusBadge status={collection.status} />
          </div>
          <p className="text-[13px] font-normal text-[var(--color-text-muted)]">
            {collection.customer ? `${collection.customer.name}` : "Cliente não informado"}
            {collectedAt ? ` · Coletada em ${collectedAt}` : ""}
          </p>
        </section>

        {/* Ação operacional sugerida */}
        <OperationalActions collectionId={collection.id} status={collection.status} />

        {/* Resumo do serviço */}
        {hasBudget ? (
          <Card className="flex flex-col gap-1 p-5 bg-[var(--color-card-bg)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Orçamento
            </span>
            <span className="text-[28px] font-semibold leading-tight text-[var(--color-text-primary)]">
              {formatBrl(budgetTotal)}
            </span>
            {serviceOrder ? (
              <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
                Prazo estimado de {serviceOrder.dueDays} {serviceOrder.dueDays === 1 ? "dia" : "dias"}
              </span>
            ) : null}
          </Card>
        ) : null}

        {/* Itens da coleta */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Itens</h2>
          {collection.items.length === 0 ? (
            <p className="text-[12px] font-normal text-[var(--color-text-muted)]">Nenhum item registrado.</p>
          ) : (
            collection.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-3 shadow-xs"
              >
                <span className="min-w-0 break-words pr-3 text-[13px] font-medium text-[var(--color-text-primary)]">
                  {item.description}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-[var(--color-text-primary)]">{item.quantity}x</span>
              </div>
            ))
          )}
        </section>

        {/* Timeline de eventos */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Histórico</h2>
          <CollectionTimeline events={events} />
        </section>

        {/* Documentos */}
        {collection.currentDocument ? (
          <PendingNavLink
            href={`/coletas/${collection.id}/documentos` as Route}
            prefetch
            className="text-center text-[13px] font-semibold text-[var(--color-primary)] active:opacity-70"
            contentClassName="block w-full"
            pendingClassName="opacity-70"
          >
            Ver documentos emitidos
          </PendingNavLink>
        ) : null}
      </div>

      <MobileBottomNav />
    </main>
  );
}
