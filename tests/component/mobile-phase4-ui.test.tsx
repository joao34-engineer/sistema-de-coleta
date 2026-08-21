import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationalDetailPage } from "@/_pages/collection-operations/ui/operational-detail-page";
import { BudgetFormPage } from "@/_pages/collection-operations/ui/budget-form-page";
import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";

describe("Phase 4 Mobile Operations UI Components", () => {
  it("renders operational detail page (O01) with collection code and action buttons", () => {
    const mockCollection = {
      id: "d3b07384-d113-40a2-a9b3-6c845b410001",
      officialCode: "MJT-2026-000102",
      status: "in_workshop" as const,
      rowVersion: 1,
      customerName: "Metalúrgica Salvat Ltda",
      customerTaxId: "12345678000195",
      collectedAt: new Date().toISOString(),
      locationDescription: "Unidade Fabril II",
      items: [
        {
          id: "item-1",
          description: "Motor Elétrico WEG 15HP",
          quantity: 2,
          condition: "Sem avarias",
          notes: null,
        },
      ],
      events: [],
    };

    render(<OperationalDetailPage collection={mockCollection} />);
    expect(screen.getByText("MJT-2026-000102")).toBeInTheDocument();
    expect(screen.getByText("Metalúrgica Salvat Ltda")).toBeInTheDocument();
    expect(screen.getByText("Ações Operacionais da Oficina")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entregar ao Cliente/i })).toBeInTheDocument();
  });

  it("renders budget form page (O03) with BRL total calculations", () => {
    const mockItems = [
      { id: "item-1", description: "Motor Elétrico WEG 15HP", quantity: 2 },
    ];

    render(
      <BudgetFormPage
        collectionId="d3b07384-d113-40a2-a9b3-6c845b410001"
        officialCode="MJT-2026-000102"
        expectedVersion={1}
        items={mockItems}
      />
    );

    expect(screen.getByText("Orçamento Técnico")).toBeInTheDocument();
    expect(screen.getByText(/Valor Total do Orçamento/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar & Enviar para Aprovação/i })).toBeInTheDocument();
  });

  it("renders customer delivery page (O04) with partial delivery badge", () => {
    const mockItems = [
      { id: "item-1", description: "Motor Elétrico WEG 15HP", quantity: 2, status: "pronto" as const },
      { id: "item-2", description: "Bomba Centrífuga KSB", quantity: 1, status: "em_reparo" as const },
    ];

    render(
      <CustomerDeliveryPage
        collectionId="d3b07384-d113-40a2-a9b3-6c845b410001"
        officialCode="MJT-2026-000102"
        expectedVersion={1}
        customerName="Metalúrgica Salvat Ltda"
        items={mockItems}
      />
    );

    expect(screen.getByText("Entrega de Equipamentos")).toBeInTheDocument();
    expect(screen.getByText("Entrega Parcial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar Entrega Parcial/i })).toBeInTheDocument();
  });
});
