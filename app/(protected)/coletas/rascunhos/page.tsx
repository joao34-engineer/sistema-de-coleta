import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";

export const dynamic = "force-dynamic";

export default async function CollectionDraftsRoute() {
  const result = await listCollections({ status: "draft", limit: 50 });
  return <CollectionsListPage initialItems={result.items} />;
}
