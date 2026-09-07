import { getBudgetItems, getDeliveryTermItems, getDeliveryTerms } from "@/_pages/collection-operations/api/queries";
import { alreadyDeliveredCollectionItemIds } from "@/_pages/collection-operations/model/delivery-selection";
import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";
import { loadCollectionForOperation } from "../../load-operation";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveryRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, terms, budgetItems] = await Promise.all([
    loadCollectionForOperation(id, "entrega"),
    getDeliveryTerms(id),
    getBudgetItems(id),
  ]);
  const termItems = (await Promise.all(terms.map((term) => getDeliveryTermItems(term.id)))).flat();

  return (
    <CustomerDeliveryPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      items={collection.items.map((collectionItem) => {
        const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
        return {
          id: collectionItem.id,
          description: collectionItem.description,
          quantity: collectionItem.quantity,
          serviceOrderStatus: budgetItem?.status ?? "em_reparo",
        };
      })}
      alreadyDeliveredItemIds={alreadyDeliveredCollectionItemIds(termItems)}
      rowVersion={collection.rowVersion}
    />
  );
}
