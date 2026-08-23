import { loadCollectionForOperation } from "../../load-operation";
import { WorkshopCheckInPage } from "@/_pages/collection-operations/ui/workshop-checkin-page";

export const dynamic = "force-dynamic";

export default async function WorkshopCheckInRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const collection = await loadCollectionForOperation(id);

  return (
    <WorkshopCheckInPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      collectionItems={collection.items.map(({ id: itemId, description, quantity }) => ({ id: itemId, description, quantity }))}
      rowVersion={collection.rowVersion}
    />
  );
}
