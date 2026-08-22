import { listCollections } from "@/_pages/collection-lifecycle/api/queries";
import { CollectionsListPage } from "@/_pages/collection-lifecycle/ui/collections-list-page";

export const dynamic = "force-dynamic";

export default async function CollectionsRoute() {
  let items: Awaited<ReturnType<typeof listCollections>>["items"] = [];
  let loadFailed = false;

  try {
    items = (await listCollections({ limit: 50 })).items;
  } catch {
    loadFailed = true;
  }

  return <CollectionsListPage initialItems={items} loadFailed={loadFailed} />;
}
