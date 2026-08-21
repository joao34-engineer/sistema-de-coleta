import { ServiceProgressPage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function ServiceProgressRoute({ params }: PageParams) {
  const { id } = await params;

  const mockItems = [
    {
      id: "d3b07384-d113-40a2-a9b3-6c845b410001",
      description: "Motor Elétrico WEG 15HP Trifásico",
      condition: "Substituição de rolamento concluída",
      status: "pronto" as const,
      notes: "Testado em bancada sem aquecimento",
    },
    {
      id: "d3b07384-d113-40a2-a9b3-6c845b410002",
      description: "Bomba Centrífuga KSB 50mm",
      condition: "Troca do selo mecânico",
      status: "em_reparo" as const,
      notes: "Aguardando cura da junta de vedação",
    },
  ];

  return (
    <ServiceProgressPage
      collectionId={id}
      officialCode="MJT-2026-000102"
      expectedVersion={1}
      items={mockItems}
    />
  );
}
