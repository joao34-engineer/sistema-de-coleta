"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
import { collectionStatusLabel, matchesStatusFilter, type CollectionsListFilter } from "../model/status-filters";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

type Props = Readonly<{
  initialItems: ReadonlyArray<CollectionListItemDTO>;
  loadFailed?: boolean;
}>;

type StatusFilter = CollectionsListFilter;

export function CollectionsListPage({ initialItems, loadFailed = false }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("all");
  const [, startTransition] = useTransition();

  if (loadFailed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader
          title="Coletas"
          subtitle="Buscar, filtrar e abrir"
        />
        <MobileStatePanel
          type="error"
          title="Não foi possível carregar as coletas"
          subtitle="Ocorreu um erro ao consultar o servidor. Suas dados não foram alterados."
          actionText="Tentar novamente"
          onAction={() => router.refresh()}
        />
        <MobileBottomNav />
      </main>
    );
  }

  const filteredItems = initialItems.filter((item) => {
    const matchesStatus = matchesStatusFilter(item.status, selectedFilter);

    const term = searchTerm.trim().toLowerCase();
    if (!term) return matchesStatus;

    const matchesCode = item.officialCode?.toLowerCase().includes(term) ?? false;
    const matchesCustomer = item.customerName?.toLowerCase().includes(term) ?? false;

    return matchesStatus && (matchesCode || matchesCustomer);
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Coletas"
        subtitle="Buscar, filtrar e abrir"
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {/* Campo de Busca (Figma Node 22:2) */}
        <Input
          placeholder="Buscar por número ou cliente"
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            startTransition(() => setSearchTerm(val));
          }}
        />

        {/* Chips de Filtro (Figma Node 22:2) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "collected", label: "Coletadas" },
              { id: "in_repair", label: "Em reparo" },
              { id: "ready", label: "Prontas" },
            ] as const
          ).map((chip) => {
            const isActive = selectedFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedFilter(chip.id)}
                className={`flex h-[36px] shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--color-text-primary)] text-white shadow-xs"
                    : "bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Lista de Cards de Coleta (Figma Node 22:2) */}
        {filteredItems.length === 0 ? (
          <MobileStatePanel
            type="empty"
            title="Nenhuma coleta encontrada"
            subtitle={
              searchTerm.trim() || selectedFilter !== "all"
                ? "Nenhuma coleta corresponde aos filtros aplicados. Ajuste a busca ou crie uma nova coleta."
                : "Você ainda não registrou nenhuma coleta. Crie a primeira para começar."
            }
            actionText="Nova coleta"
            onAction={() => router.push("/coletas/nova" as Route)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={
                  item.status === "draft"
                    ? (`/coletas/${item.id}/itens` as Route)
                    : (`/coletas/${item.id}` as Route)
                }
                className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs transition-all hover:border-[var(--color-primary)] active:scale-[0.99]"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {item.officialCode ?? "Rascunho"}
                  </h2>
                  <p className="text-[12px] font-normal text-[var(--color-text-muted)]">
                    {item.customerName ?? "Cliente não informado"}
                  </p>
                </div>

                <Badge status={item.status}>{collectionStatusLabel[item.status]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}

