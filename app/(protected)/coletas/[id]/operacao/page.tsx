import { OperationalDetailPage } from "@/_pages/collection-operations";

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function CollectionOperationalPage({ params }: PageParams) {
  const { id } = await params;

  const mockCollection = {
    id,
    officialCode: "MJT-2026-000102",
    status: "in_workshop" as const,
    rowVersion: 1,
    customerName: "Metalúrgica Salvat Ltda",
    customerTaxId: "12345678000195",
    collectedAt: "2026-08-20T10:00:00.000Z",
    locationDescription: "Unidade Fabril II — Av. Industrial, 450",
    items: [
      {
        id: "d3b07384-d113-40a2-a9b3-6c845b410001",
        description: "Motor Elétrico WEG 15HP Trifásico",
        quantity: 2,
        condition: "Sem avarias externas aparentes",
        notes: "Ruído anormal no rolamento",
      },
      {
        id: "d3b07384-d113-40a2-a9b3-6c845b410002",
        description: "Bomba Centrífuga KSB 50mm",
        quantity: 1,
        condition: "Vazamento no selo mecânico",
        notes: "Urgência de manutenção",
      },
    ],
    events: [
      {
        id: "evt-01",
        type: "Coleta Realizada",
        previousStatus: "draft",
        nextStatus: "collected",
        reason: "Coleta efetuada no cliente",
        actorName: "João Marcelo (Coletor)",
        createdAt: "2026-08-20T10:00:00.000Z",
      },
      {
        id: "evt-02",
        type: "Entrada na Oficina",
        previousStatus: "collected",
        nextStatus: "in_workshop",
        reason: "Recebido na oficina fixa MJT",
        actorName: "Carlos Silva (Admin Oficina)",
        createdAt: "2026-08-21T08:30:00.000Z",
      },
    ],
  };

  return <OperationalDetailPage collection={mockCollection} />;
}
