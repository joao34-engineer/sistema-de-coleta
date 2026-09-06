import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { collectionQuerySchema } from "@/_pages/collection-lifecycle/model/contracts";
import { flattenSearchParams } from "@/_pages/collection-lifecycle/model/list-search";
import { statusesForListFilter } from "@/_pages/collection-lifecycle/model/status-filters";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";
import type { CollectionListItemDTO } from "@/_pages/collection-lifecycle/model/contracts";
import type { CollectionsListFilter } from "@/shared/model/collection-status";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function CollectionsRoute({ searchParams }: Props) {
  const raw = flattenSearchParams(await searchParams);
  const parsed = collectionQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : collectionQuerySchema.parse({});
  const filter: CollectionsListFilter = query.filter ?? "all";
  const q = query.q && query.q.length > 0 ? query.q : undefined;

  let items: ReadonlyArray<CollectionListItemDTO> = [];
  let nextCursor: string | null = null;
  let totalCount = 0;
  let loadFailed = false;

  try {
    const result = await listCollections({
      limit: 25,
      filter,
      statuses: [...statusesForListFilter(filter)],
      ...(q ? { q } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    items = result.items;
    nextCursor = result.nextCursor;
    totalCount = result.totalCount;
  } catch {
    loadFailed = true;
  }

  return (
    <CollectionsListPage
      initialItems={items}
      searchTerm={q ?? ""}
      selectedFilter={filter}
      nextCursor={nextCursor}
      totalCount={totalCount}
      loadFailed={loadFailed}
    />
  );
}
