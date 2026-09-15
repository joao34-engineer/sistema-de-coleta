"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import type { CollectionListItemDTO } from "../model/contracts";
import { buildCollectionsListHref } from "../model/list-search";
import {
  statusesForListFilter,
  type CollectionStatus,
  type CollectionsListFilter,
} from "../model/status-filters";
import { listRowStatusClassName, listRowStatusLabel, listRowStatusTone } from "../model/list-row-status";
import { listRowCustomerLine } from "../model/list-row-customer-line";
import { loadMoreCollectionsAction } from "../api/actions";
import { CollectionsListFilterChip } from "./collections-list-filter-chip";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { PendingNavLink } from "@/shared/ui/pending-nav-link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const DEFAULT_TITLE = "Coletas";
const DEFAULT_SUBTITLE = "Buscar, filtrar e abrir";
const DEFAULT_EMPTY_TITLE = "Nenhuma coleta encontrada";
const DEFAULT_EMPTY_SUBTITLE =
  "Você ainda não registrou nenhuma coleta. Crie a primeira para começar.";
const FILTERED_EMPTY_SUBTITLE =
  "Nenhuma coleta corresponde aos filtros aplicados. Ajuste a busca ou crie uma nova coleta.";

type Props = Readonly<{
  initialItems: ReadonlyArray<CollectionListItemDTO>;
  searchTerm?: string;
  selectedFilter?: CollectionsListFilter;
  nextCursor?: string | null;
  totalCount?: number;
  loadFailed?: boolean;
  showStatusFilters?: boolean;
  status?: CollectionStatus;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  showSearch?: boolean;
}>;

const SEARCH_DEBOUNCE_MS = 300;

const LIST_FILTER_CHIPS = [
  { id: "all", label: "Todos" },
  { id: "draft", label: "Rascunho" },
  { id: "collected", label: "Coletada" },
  { id: "in_repair", label: "Em reparo" },
  { id: "ready", label: "Pronta" },
  { id: "invoiced", label: "Faturada" },
  { id: "partial_delivery", label: "Entrega parcial" },
  { id: "canceled", label: "Cancelada" },
] as const satisfies ReadonlyArray<{ id: CollectionsListFilter; label: string }>;

export function CollectionsListPage({
  initialItems,
  searchTerm = "",
  selectedFilter = "all",
  nextCursor = null,
  loadFailed = false,
  showStatusFilters = true,
  status,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptySubtitle = DEFAULT_EMPTY_SUBTITLE,
  showSearch = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [draftQ, setDraftQ] = useState(searchTerm);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [, startTransition] = useTransition();
  const [pendingFilter, setPendingFilter] = useState<CollectionsListFilter | null>(null);
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

  if (pendingFilter !== null && pendingFilter === selectedFilter) {
    setPendingFilter(null);
  }

  const displayedFilter = pendingFilter ?? selectedFilter;

  useEffect(() => {
    if (!showSearch) return;
    const handle = window.setTimeout(() => {
      if (draftQ.trim() === searchTerm.trim()) return;
      startTransition(() => {
        router.replace(buildCollectionsListHref(pathname, { q: draftQ, filter: selectedFilter }));
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQ, pathname, router, searchTerm, selectedFilter, showSearch]);

  useEffect(() => {
    if (!showStatusFilters) return;
    for (const chip of LIST_FILTER_CHIPS) {
      if (chip.id === selectedFilter) continue;
      router.prefetch(buildCollectionsListHref(pathname, { q: searchTerm, filter: chip.id }));
    }
  }, [pathname, router, searchTerm, selectedFilter, showStatusFilters]);

  if (loadFailed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-28">
        <MobilePageHeader
          logoSrc="/logo/Logo_-_MJT-removebg-preview.png"
          title={title}
          subtitle={subtitle}
        />
        <MobileStatePanel
          type="error"
          title="Não foi possível carregar as coletas"
          subtitle="Ocorreu um erro ao consultar o servidor. Seus dados não foram alterados."
          actionText="Tentar novamente"
          onAction={() => router.refresh()}
        />
        <MobileBottomNav />
      </main>
    );
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        logoSrc="/logo/Logo_-_MJT-removebg-preview.png"
        title={title}
        subtitle={subtitle}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {showSearch ? (
          <Input
            placeholder="Buscar por número ou cliente"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
          />
        ) : null}

        {showStatusFilters ? (
          <div className="flex flex-wrap content-start gap-2">
            {LIST_FILTER_CHIPS.map((chip) => (
              <CollectionsListFilterChip
                key={chip.id}
                href={buildCollectionsListHref(pathname, { q: draftQ, filter: chip.id })}
                label={chip.label}
                isSelected={displayedFilter === chip.id}
                onSelect={() => setPendingFilter(chip.id)}
              />
            ))}
          </div>
        ) : null}

        {items.length === 0 ? (
          <MobileStatePanel
            type="empty"
            title={emptyTitle}
            subtitle={
              searchTerm.trim() || selectedFilter !== "all" ? FILTERED_EMPTY_SUBTITLE : emptySubtitle
            }
            actionText="Nova coleta"
            onAction={() => router.push("/coletas/nova" as Route)}
          />
        ) : (
          <div className="flex flex-col gap-[14px]">
            {items.map((item) => {
              const tone = listRowStatusTone(item.status);
              return (
                <PendingNavLink
                  key={item.id}
                  href={
                    item.status === "draft"
                      ? (`/coletas/${item.id}/itens` as Route)
                      : (`/coletas/${item.id}` as Route)
                  }
                  className="flex min-h-[88px] flex-col justify-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-[18px]"
                  contentClassName="flex w-full flex-col"
                  pendingClassName="opacity-70 ring-2 ring-[var(--color-primary)]/30"
                >
                  <h2 className="text-[14px] font-semibold leading-5 text-[var(--color-text-primary)]">
                    {item.officialCode ?? "sem número oficial"}
                  </h2>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[12px] font-normal leading-4 text-[var(--color-text-muted)]">
                      {listRowCustomerLine(item.customerName, item.itemCount)}
                    </p>
                    <p className={`shrink-0 text-[12px] font-semibold leading-4 ${listRowStatusClassName[tone]}`}>
                      {listRowStatusLabel(item.status)}
                    </p>
                  </div>
                </PendingNavLink>
              );
            })}

            {cursor ? (
              <div className="flex flex-col items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={loadingMore}
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
