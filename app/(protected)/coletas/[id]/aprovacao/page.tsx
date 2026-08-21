import { BudgetApprovalPage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function BudgetApprovalRoute({ params }: PageParams) {
  const { id } = await params;

  const mockItems = [
    { id: "d3b07384-d113-40a2-a9b3-6c845b410001", description: "Motor Elétrico WEG 15HP Trifásico", laborCostBrl: 450, partsCostBrl: 320, estimatedDays: 3 },
    { id: "d3b07384-d113-40a2-a9b3-6c845b410002", description: "Bomba Centrífuga KSB 50mm", laborCostBrl: 300, partsCostBrl: 180, estimatedDays: 2 },
  ];

  return (
    <BudgetApprovalPage
      collectionId={id}
      officialCode="MJT-2026-000102"
      expectedVersion={1}
      customerName="Metalúrgica Salvat Ltda"
      totalBudgetBrl={1250}
      items={mockItems}
    />
  );
}
