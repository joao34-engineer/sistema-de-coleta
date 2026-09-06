"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
import { buildCollectionsListHref } from "../model/list-search";
import {
  collectionStatusLabel,
  statusesForListFilter,
  type CollectionStatus,
  type CollectionsListFilter,
} from "../model/status-filters";
import { loadMoreCollectionsAction } from "../api/actions";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type Props = Readonly<{
  initialItems: ReadonlyArray<CollectionListItemDTO>;
  searchTerm?: string;
  selectedFilter?: CollectionsListFilter;
  nextCursor?: string | null;
  totalCount?: number;
  loadFailed?: boolean;
  showStatusFilters?: boolean;
  status?: CollectionStatus;
}>;

const SEARCH_DEBOUNCE_MS = 300;

export function CollectionsListPage({
  initialItems,
  searchTerm = "",
  selectedFilter = "all",
  nextCursor = null,
  loadFailed = false,
  showStatusFilters = true,
  status,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftQ, setDraftQ] = useState(searchTerm);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [syncedSearchTerm, setSyncedSearchTerm] = useState(searchTerm);
  const [syncedItems, setSyncedItems] = useState(initialItems);
  const [syncedCursor, setSyncedCursor] = useState(nextCursor);

  if (searchTerm !== syncedSearchTerm || initialItems !== syncedItems || nextCursor !== syncedCursor) {
    setSyncedSearchTerm(searchTerm);
    setSyncedItems(initialItems);
    setSyncedCursor(nextCursor);
    setDraftQ(searchTerm);
    setItems(initialItems);
    setCursor(nextCursor);
    setLoadMoreFailed(false);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draftQ.trim() === searchTerm.trim()) return;
      startTransition(() => {
        router.replace(buildCollectionsListHref(pathname, { q: draftQ, filter: selectedFilter }));
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQ, pathname, router, searchTerm, selectedFilter]);

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

  function replaceListQuery(next: Readonly<{ q: string; filter: CollectionsListFilter }>) {
    startTransition(() => {
      router.replace(buildCollectionsListHref(pathname, next));
    });
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    const result = await loadMoreCollectionsAction({
      ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
      ...(status ? { status } : { filter: selectedFilter, statuses: [...statusesForListFilter(selectedFilter)] }),
      cursor,
      limit: 25,
    });
    setLoadingMore(false);
    if (!result.ok) {
      setLoadMoreFailed(true);
      return;
    }
    setItems((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Coletas"
        subtitle="Buscar, filtrar e abrir"
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        <Input
          placeholder="Buscar por número, cliente, CPF ou telefone"
          value={draftQ}
          onChange={(event) => setDraftQ(event.target.value)}
        />

        {showStatusFilters ? (
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
                  onClick={() => replaceListQuery({ q: draftQ, filter: chip.id })}
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
        ) : null}

        {items.length === 0 ? (
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
            {items.map((item) => (
              <PendingNavLink
                key={item.id}
                href={
                  item.status === "draft"
                    ? (`/coletas/${item.id}/itens` as Route)
                    : (`/coletas/${item.id}` as Route)
                }
                className="flex items-center justify-between rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs transition-all hover:border-[var(--color-primary)] active:scale-[0.99]"
                contentClassName="flex w-full items-center justify-between"
                pendingClassName="opacity-70 ring-2 ring-[var(--color-primary)]/30"
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
              </PendingNavLink>
            ))}

            {cursor ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={loadingMore || isPending}
                  onClick={() => void loadMore()}
                >
                  Carregar mais
                </Button>
                {loadMoreFailed ? (
                  <p className="text-[12px] text-[var(--color-text-muted)]">Não foi possível carregar a próxima página.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}
