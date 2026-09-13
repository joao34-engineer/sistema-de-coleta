import { CollectionsListPage, type CollectionListItemDTO } from "@/_pages/collection-lifecycle";
import { collectionQuerySchema, flattenSearchParams, listCollections, statusesForListFilter } from "@/_pages/collection-lifecycle/index.server";
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
