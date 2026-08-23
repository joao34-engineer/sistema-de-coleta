import { getBudgetItems } from "@/_pages/collection-operations/api/queries";
import { loadCollectionForOperation } from "../../load-operation";
import { budgetTotalOf } from "../budget-total";
import { TechnicalBudgetPage } from "@/_pages/collection-operations/ui/technical-budget-page";

export const dynamic = "force-dynamic";

export default async function TechnicalBudgetRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, budgetItems] = await Promise.all([loadCollectionForOperation(id), getBudgetItems(id)]);

  const budgetItemsWithDescription = budgetItems.map((item) => ({
    ...item,
    itemDescription: collection.items.find((collectionItem) => collectionItem.id === item.collectionItemId)?.description ?? "Item da coleta",
  }));

  return (
    <TechnicalBudgetPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetItems={budgetItemsWithDescription}
      budgetTotal={budgetTotalOf(budgetItems)}
      rowVersion={collection.rowVersion}
    />
  );
}
