"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

type Props = Readonly<{
  initialItems: ReadonlyArray<CollectionListItemDTO>;
}>;

type StatusFilter = "all" | "collected" | "in_repair" | "ready";

export function CollectionsListPage({ initialItems }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("all");
  const [, startTransition] = useTransition();

  const filteredItems = initialItems.filter((item) => {
    const matchesStatus =
      selectedFilter === "all" ||
      (selectedFilter === "collected" && item.status === "collected") ||
      (selectedFilter === "ready" && item.status === "ready") ||
      (selectedFilter === "in_repair" && item.status === "draft");

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
          <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 text-center shadow-xs">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              Nenhuma coleta encontrada
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={
                  item.status === "draft"
                    ? (`/coletas/${item.id}/itens` as Route)
                    : (`/coletas/${item.id}/documentos` as Route)
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

                <Badge status={item.status === "draft" ? "draft" : item.status}>
                  {item.status === "draft" ? "Rascunho" : item.status === "ready" ? "Pronto" : "Em reparo"}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}

