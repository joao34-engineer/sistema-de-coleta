"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
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
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
      {/* Top Header Mobile */}
      <header className="mb-6">
        <Link
          href={"/dashboard" as Route}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          ← Voltar ao Dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              MJT · Operações
            </span>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              Lista de Coletas
            </h1>
          </div>
          <Link href={"/coletas/nova" as Route}>
            <Button variant="primary" size="sm">
              + Nova
            </Button>
          </Link>
        </div>
      </header>

      {/* Filtros e Busca */}
      <div className="mb-6 flex flex-col gap-4">
        <Input
          placeholder="Buscar por código (MJT-...), cliente ou CPF/CNPJ"
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            startTransition(() => setSearchTerm(val));
          }}
        />

        {/* Status Filter Chips */}
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
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors min-h-[36px] min-w-[44px] flex items-center justify-center ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "bg-[var(--color-surface-neutral)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Cards */}
      {filteredItems.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Nenhuma coleta encontrada
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Tente buscar com outro termo ou alterar o filtro de status.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 p-4">
              <CardHeader className="p-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[var(--color-text)]">
                      {item.officialCode ?? "Rascunho de Coleta"}
                    </h2>
                    <p className="text-xs font-medium text-[var(--color-muted)]">
                      {item.customerName ?? "Cliente não informado"}
                    </p>
                  </div>
                  <Badge status={item.status}>
                    {getStatusBadgeLabel(item.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-0 text-xs text-[var(--color-muted)] flex flex-col gap-1">
                {item.customerTaxId ? (
                  <p>CPF/CNPJ: {item.customerTaxId}</p>
                ) : null}
                <p>Data: {formatDate(item.collectedAt ?? item.createdAt)}</p>
              </CardContent>

              <CardFooter className="p-0 pt-2 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
                {item.status === "draft" ? (
                  <Link href={`/coletas/${item.id}/itens` as Route}>
                    <Button variant="secondary" size="sm">
                      Continuar Rascunho
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/coletas/${item.id}/documentos` as Route}>
                    <Button variant="secondary" size="sm">
                      Ver Documentos
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
