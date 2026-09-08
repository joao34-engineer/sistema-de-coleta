import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";
import { loadCollectionForOperation } from "../../load-operation";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveryRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { collection, budgetItems, alreadyDeliveredItemIds } = await loadCollectionForOperation(id, "entrega");

  return (
    <CustomerDeliveryPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      items={collection.items.flatMap((collectionItem) => {
        const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
        if (budgetItem === undefined || budgetItem.status === null) {
          return [];
        }
        return [{
          id: collectionItem.id,
          description: collectionItem.description,
          quantity: collectionItem.quantity,
          serviceOrderStatus: budgetItem.status,
        }];
      })}
      alreadyDeliveredItemIds={alreadyDeliveredItemIds}
      rowVersion={collection.rowVersion}
    />
  );
}
