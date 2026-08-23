import { loadCollectionForOperation } from "../../load-operation";
import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveryRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const collection = await loadCollectionForOperation(id);

  return (
    <CustomerDeliveryPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      items={collection.items.map(({ id: itemId, description, quantity }) => ({ id: itemId, description, quantity }))}
      rowVersion={collection.rowVersion}
    />
  );
}
