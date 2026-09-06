import { getBudgetItems } from "@/_pages/collection-operations/api/queries";
import { loadCollectionForOperation } from "../../load-operation";
import { ServiceProgressPage } from "@/_pages/collection-operations/ui/service-progress-page";

export const dynamic = "force-dynamic";

export default async function ServiceProgressRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, budgetItems] = await Promise.all([loadCollectionForOperation(id, "progresso"), getBudgetItems(id)]);

  const progressItems = collection.items.map((collectionItem) => {
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
