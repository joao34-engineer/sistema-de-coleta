import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { collectionQuerySchema } from "@/_pages/collection-lifecycle/model/contracts";
import { flattenSearchParams } from "@/_pages/collection-lifecycle/model/list-search";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";

export const dynamic = "force-dynamic";

type Props = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function CollectionDraftsRoute({ searchParams }: Props) {
  const raw = flattenSearchParams(await searchParams);
  const parsed = collectionQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : collectionQuerySchema.parse({});
  const q = query.q && query.q.length > 0 ? query.q : undefined;
  const result = await listCollections({
    status: "draft",
    limit: 25,
    ...(q ? { q } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  return (
    <CollectionsListPage
      initialItems={result.items}
      searchTerm={q ?? ""}
      nextCursor={result.nextCursor}
      totalCount={result.totalCount}
      showStatusFilters={false}
      status="draft"
    />
  );
}
