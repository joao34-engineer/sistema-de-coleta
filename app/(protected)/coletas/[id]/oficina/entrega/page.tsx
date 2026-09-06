import { getDeliveryTermItems, getDeliveryTerms } from "@/_pages/collection-operations/api/queries";
import { alreadyDeliveredCollectionItemIds } from "@/_pages/collection-operations/model/delivery-selection";
import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";
import { loadCollectionForOperation } from "../../load-operation";

export const dynamic = "force-dynamic";

export default async function CustomerDeliveryRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, terms] = await Promise.all([loadCollectionForOperation(id, "entrega"), getDeliveryTerms(id)]);
  const termItems = (await Promise.all(terms.map((term) => getDeliveryTermItems(term.id)))).flat();

  return (
    <CustomerDeliveryPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      items={collection.items.map(({ id: itemId, description, quantity }) => ({ id: itemId, description, quantity }))}
      alreadyDeliveredItemIds={alreadyDeliveredCollectionItemIds(termItems)}
      rowVersion={collection.rowVersion}
    />
  );
}
