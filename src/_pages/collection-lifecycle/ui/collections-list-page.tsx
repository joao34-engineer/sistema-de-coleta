"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

type Props = Readonly<{
  initialItems: ReadonlyArray<CollectionListItemDTO>;
}>;

type StatusFilter = "all" | "draft" | "collected" | "canceled";

function formatDate(isoString: string | null): string {
  if (!isoString) return "Data não registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoString));
}

function getStatusBadgeLabel(status: CollectionListItemDTO["status"]): string {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "collected":
      return "Coletada";
    case "canceled":
      return "Cancelada";
    default:
      return status;
  }
}

export function CollectionsListPage({ initialItems }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>("all");
  const [, startTransition] = useTransition();

  const filteredItems = initialItems.filter((item) => {
    const matchesStatus =
      selectedFilter === "all" || item.status === selectedFilter;

    const term = searchTerm.trim().toLowerCase();
    if (!term) return matchesStatus;

    const matchesCode = item.officialCode?.toLowerCase().includes(term) ?? false;
    const matchesCustomer = item.customerName?.toLowerCase().includes(term) ?? false;
    const matchesTaxId = item.customerTaxId?.includes(term) ?? false;

    return matchesStatus && (matchesCode || matchesCustomer || matchesTaxId);
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Lista de coletas"
        subtitle="Busca e histórico"
        badge={
          <Link href={"/coletas/nova" as Route}>
            <Button variant="primary" size="sm" className="min-h-[38px] px-3">
              + Nova
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-4 px-4">
        {/* Campo de Busca */}
        <Input
          placeholder="Buscar por código, cliente ou CPF/CNPJ"
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            startTransition(() => setSearchTerm(val));
          }}
        />

        {/* Chips de Filtro Circular (Radius 999px) */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: "Todas" },
              { id: "draft", label: "Rascunhos" },
              { id: "collected", label: "Coletadas" },
              { id: "canceled", label: "Canceladas" },
            ] as const
          ).map((chip) => {
            const isActive = selectedFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedFilter(chip.id)}
                className={`flex h-[36px] items-center justify-center rounded-full px-3.5 text-[12px] font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "bg-[var(--color-surface-neutral)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Lista de Cards de Coleta */}
        {filteredItems.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-[14px] font-semibold text-[var(--color-text)]">
              Nenhuma coleta encontrada
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Tente buscar com outro termo ou alterar o filtro de status.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className="flex flex-col gap-3 p-4">
                <CardHeader className="p-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[14px] font-semibold text-[var(--color-text)]">
                        {item.officialCode ?? "Rascunho de Coleta"}
                      </h2>
                      <p className="text-[12px] text-[var(--color-muted)]">
                        {item.customerName ?? "Cliente não informado"}
                      </p>
                    </div>
                    <Badge status={item.status}>
                      {getStatusBadgeLabel(item.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-1 p-0 text-[12px] text-[var(--color-muted)]">
                  {item.customerTaxId ? (
                    <p>CPF/CNPJ: {item.customerTaxId}</p>
                  ) : null}
                  <p>Data: {formatDate(item.collectedAt ?? item.createdAt)}</p>
                </CardContent>

                <CardFooter className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] p-0 pt-2">
                  {item.status === "draft" ? (
                    <Link href={`/coletas/${item.id}/itens` as Route}>
                      <Button variant="secondary" size="sm" className="min-h-[38px] px-3">
                        Continuar Rascunho
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/coletas/${item.id}/documentos` as Route}>
                      <Button variant="secondary" size="sm" className="min-h-[38px] px-3">
                        Ver Documentos
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}
