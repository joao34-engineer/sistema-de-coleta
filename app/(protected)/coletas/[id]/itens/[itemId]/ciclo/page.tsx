import { ItemLifecyclePage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string; itemId: string }>;
}

export default async function ItemLifecycleRoute({ params }: PageParams) {
  const { id, itemId } = await params;

  const mockItem = {
    id: itemId,
    description: "Motor Elétrico WEG 15HP Trifásico",
    quantity: 2,
    condition: "Sem avarias externas aparentes",
    notes: "Ruído anormal no rolamento acoplado",
    laborCostBrl: 450,
    partsCostBrl: 320,
    status: "in_service" as const,
  };

  const mockEvents = [
    {
      id: "e1",
      eventType: "Coleta Realizada",
      description: "Item coletado nas instalações do cliente",
      actorName: "João Marcelo",
      createdAt: "2026-08-19T14:00:00.000Z",
    },
    {
      id: "e2",
      eventType: "Entrada na Oficina",
      description: "Check-in efetuado com assinatura do admin da oficina MJT",
      actorName: "Carlos Silva",
      createdAt: "2026-08-20T09:15:00.000Z",
    },
    {
      id: "e3",
      eventType: "Orçamento Aprovado",
      description: "Cliente aprovou o valor de R$ 770,00",
      actorName: "Roberto Salvat",
      createdAt: "2026-08-21T11:30:00.000Z",
    },
  ];

  return (
    <ItemLifecyclePage
      collectionId={id}
      officialCode="MJT-2026-000102"
      item={mockItem}
      events={mockEvents}
    />
  );
}
