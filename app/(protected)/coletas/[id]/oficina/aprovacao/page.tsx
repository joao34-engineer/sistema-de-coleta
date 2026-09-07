import { loadCollectionForOperation } from "../../load-operation";
import { budgetTotalOf } from "../budget-total";
import { BudgetApprovalPage } from "@/_pages/collection-operations/ui/budget-approval-page";

export const dynamic = "force-dynamic";

export default async function BudgetApprovalRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { collection, budgetItems } = await loadCollectionForOperation(id, "aprovacao");

  return (
    <BudgetApprovalPage
      collectionId={collection.id}
      officialCode={collection.officialCode}
      budgetTotal={budgetTotalOf(budgetItems)}
      rowVersion={collection.rowVersion}
    />
  );
}
