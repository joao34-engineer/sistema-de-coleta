import { BudgetFormPage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function BudgetRoute({ params }: PageParams) {
  const { id } = await params;

  const mockItems = [
    { id: "d3b07384-d113-40a2-a9b3-6c845b410001", description: "Motor Elétrico WEG 15HP Trifásico", quantity: 2 },
    { id: "d3b07384-d113-40a2-a9b3-6c845b410002", description: "Bomba Centrífuga KSB 50mm", quantity: 1 },
  ];

  return (
    <BudgetFormPage
      collectionId={id}
      officialCode="MJT-2026-000102"
      expectedVersion={1}
      items={mockItems}
    />
  );
}
