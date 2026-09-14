"use client";

import type { Route } from "next";
import { collectionStatusLabel } from "@/entities/collection";
import type { CollectionHubView, CollectionEventSummary, ServiceOrder, BudgetItem } from "../model/view-models";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Card } from "@/shared/ui/card";
import { CollectionStatusBadge } from "./collection-status-badge";
import { CollectionTimeline } from "./collection-timeline";
import { OperationalActions } from "./operational-actions";
import { budgetTotalOf } from "../model/budget-seed";
import { operationalItemFactsFrom } from "../model/operational-actions";
import { formatDateTimePtBr } from "@/shared/lib/format-date-time-pt-br";

export type CollectionDetailHubProps = Readonly<{
  collection: CollectionHubView;
  events: ReadonlyArray<CollectionEventSummary>;
  serviceOrder: ServiceOrder | null;
  budgetItems: ReadonlyArray<BudgetItem>;
  alreadyDeliveredItemIds: ReadonlyArray<string>;
}>;

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return formatDateTimePtBr(value);
}

function hubSubtitle(itemCount: number, statusLabel: string): string {
  const itemWord = itemCount === 1 ? "item" : "itens";
  return `${itemCount} ${itemWord} · ${statusLabel}`;
}

export function CollectionDetailHub({
  collection,
  events,
  serviceOrder,
  budgetItems,
  alreadyDeliveredItemIds,
}: CollectionDetailHubProps) {
  const budgetTotal = budgetTotalOf(budgetItems);
  const collectedAt = formatDate(collection.collectedAt);
  const hasBudget = budgetItems.length > 0;
  const itemCount = collection.items.length;
  const statusLabel = collectionStatusLabel[collection.status];
  const headerTitle = collection.officialCode ? `Guia ${collection.officialCode}` : "Coleta";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title={headerTitle}
        subtitle={hubSubtitle(itemCount, statusLabel)}
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        <CollectionStatusBadge status={collection.status} />
        {collection.status === "rejected" ? (
          <p className="text-[20px] font-semibold leading-8 text-[var(--color-danger)]">Orçamento rejeitado</p>
        ) : null}

        <section className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold leading-8 text-[var(--color-text-primary)]">
            {collection.customer ? collection.customer.name : "Cliente não informado"}
          </h2>
          {collectedAt ? (
            <p className="text-[14px] font-normal leading-5 text-[var(--color-text-muted)]">
              Coletada em {collectedAt}
            </p>
          ) : null}
          <p className="text-[14px] font-normal leading-5 text-[var(--color-text-muted)]">
            {itemCount === 0
              ? "Nenhum item registrado."
              : collection.items.map((item) => `${item.quantity}× ${item.description}`).join(" · ")}
          </p>
        </section>

        {hasBudget ? (
          <Card className="flex w-full max-w-[342px] flex-col gap-1 bg-[var(--color-card-bg)]">
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

        <Card className="flex w-full max-w-[342px] flex-col gap-3 bg-[var(--color-card-bg)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Linha do tempo
          </h2>
          <CollectionTimeline events={events} />
        </Card>

        {collection.currentDocument ? (
          <PendingNavLink
            href={`/coletas/${collection.id}/documentos` as Route}
            prefetch
            className="text-left text-[13px] font-semibold text-[var(--color-primary)] active:opacity-70"
            contentClassName="block w-full"
            pendingClassName="opacity-70"
          >
            Ver documentos emitidos
          </PendingNavLink>
        ) : null}

        <OperationalActions
          collectionId={collection.id}
          status={collection.status}
          itemFacts={operationalItemFactsFrom(
            collection.items.map((item) => item.id),
            budgetItems,
            alreadyDeliveredItemIds,
          )}
        />
      </div>

      <MobileBottomNav />
    </main>
  );
}
