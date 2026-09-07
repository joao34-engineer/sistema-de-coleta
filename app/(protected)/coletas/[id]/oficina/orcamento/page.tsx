import { seedBudgetItemsFromCollection } from "@/_pages/collection-operations/model/budget-seed";
import { loadCollectionForOperation } from "../../load-operation";
import { budgetTotalOf } from "../budget-total";
import { TechnicalBudgetPage } from "@/_pages/collection-operations/ui/technical-budget-page";

export const dynamic = "force-dynamic";

export default async function TechnicalBudgetRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { collection, budgetItems } = await loadCollectionForOperation(id, "orcamento");

  const budgetItemsForForm = seedBudgetItemsFromCollection({
    collectionItems: collection.items,
    budgetItems,
  });

  return (
    <TechnicalBudgetPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetItems={budgetItemsForForm}
      budgetTotal={budgetTotalOf(budgetItemsForForm)}
      rowVersion={collection.rowVersion}
    />
  );
}
