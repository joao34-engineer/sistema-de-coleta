import { getBudgetItems } from "@/_pages/collection-operations/api/queries";
import { loadCollectionForOperation } from "../../load-operation";
import { budgetTotalOf } from "../budget-total";
import { BudgetApprovalPage } from "@/_pages/collection-operations/ui/budget-approval-page";

export const dynamic = "force-dynamic";

export default async function BudgetApprovalRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [collection, budgetItems] = await Promise.all([loadCollectionForOperation(id, "aprovacao"), getBudgetItems(id)]);

  return (
    <BudgetApprovalPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetTotal={budgetTotalOf(budgetItems)}
      rowVersion={collection.rowVersion}
    />
  );
}
