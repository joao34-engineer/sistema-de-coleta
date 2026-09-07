import { loadCollectionForOperation } from "../../load-operation";
import { ServiceProgressPage } from "@/_pages/collection-operations/ui/service-progress-page";

export const dynamic = "force-dynamic";

export default async function ServiceProgressRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { collection, budgetItems, alreadyDeliveredItemIds } = await loadCollectionForOperation(id, "progresso");

  const deliveredItemIds = new Set(alreadyDeliveredItemIds);
  const progressItems = collection.items
    .filter((collectionItem) => !deliveredItemIds.has(collectionItem.id))
    .map((collectionItem) => {
      const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
      return {
        itemId: collectionItem.id,
        itemDescription: collectionItem.description,
        status: (budgetItem?.status ?? "em_reparo") as "em_reparo" | "pronto",
        notes: budgetItem?.notes ?? null,
      };
    });

  return (
    <ServiceProgressPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      progressItems={progressItems}
      rowVersion={collection.rowVersion}
    />
  );
}
