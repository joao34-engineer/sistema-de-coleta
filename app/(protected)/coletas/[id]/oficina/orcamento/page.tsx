import { TechnicalBudgetRoute } from "@/_pages/collection-operations/index.server";

export const dynamic = "force-dynamic";

export default async function TechnicalBudgetPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return TechnicalBudgetRoute({ collectionId: id });
}
