import { BudgetApprovalRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function BudgetApprovalPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return BudgetApprovalRoute({ collectionId: id });
}
