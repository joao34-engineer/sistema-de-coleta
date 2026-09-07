import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerDeliveryPage } from "@/_pages/collection-operations/ui/customer-delivery-page";

const deliverToCustomerAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/11111111-1111-4111-8111-111111111111/oficina/entrega",
}));

vi.mock("@/_app/actions/phase3-flow.actions", () => ({
  deliverToCustomerAction: (...args: unknown[]) => deliverToCustomerAction(...args),
}));

const pendingItemId = "11111111-1111-4111-8111-111111111111";
const deliveredItemId = "22222222-2222-4222-8222-222222222222";
const inRepairItemId = "44444444-4444-4444-8444-444444444444";
const secondReadyItemId = "55555555-5555-4555-8555-555555555555";

type DeliveryItemInput = Readonly<{
  id: string;
  description: string;
  quantity: number;
  serviceOrderStatus: "em_reparo" | "pronto";
}>;

const defaultItems: ReadonlyArray<DeliveryItemInput> = [
  { id: pendingItemId, description: "Motor WEG 15HP", quantity: 1, serviceOrderStatus: "pronto" },
  { id: deliveredItemId, description: "Bomba d'água", quantity: 2, serviceOrderStatus: "pronto" },
];

function renderDeliveryPage(
  alreadyDeliveredItemIds: ReadonlyArray<string> = [deliveredItemId],
  items: ReadonlyArray<DeliveryItemInput> = defaultItems,
): void {
  render(
    <CustomerDeliveryPage
      collectionId="33333333-3333-4333-8333-333333333333"
      officialCode="MJT-2026-000099"
      items={items}
      alreadyDeliveredItemIds={alreadyDeliveredItemIds}
      rowVersion={4}
    />,
  );
}

describe("CustomerDeliveryPage (5.5)", () => {
  afterEach(() => {
    cleanup();
    deliverToCustomerAction.mockReset();
  });

  it("starts with no item pre-checked, including pending ones", () => {
    renderDeliveryPage([]);
    const pending = screen.getByRole("checkbox", { name: "Motor WEG 15HP" });
    const other = screen.getByRole("checkbox", { name: "Bomba d'água" });
    expect(pending).not.toBeChecked();
    expect(other).not.toBeChecked();
    expect(pending).toBeEnabled();
    expect(other).toBeEnabled();
  });

  it("shows already-delivered rows visible but disabled", () => {
    renderDeliveryPage();
    expect(screen.getByText("já entregue")).toBeInTheDocument();
    expect(screen.getByText("Bomba d'água")).toBeInTheDocument();
    const delivered = screen.getByRole("checkbox", { name: "Bomba d'água já entregue" });
    expect(delivered).toBeDisabled();
    expect(delivered).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Motor WEG 15HP" })).toBeEnabled();
  });

  it("keeps the empty-selection guard and does not call the action", async () => {
    renderDeliveryPage();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    expect(screen.getByText("Selecione ao menos um item para entrega.")).toBeInTheDocument();
    expect(deliverToCustomerAction).not.toHaveBeenCalled();
  });

  it("lets the operator select only pending items", () => {
    renderDeliveryPage();
    const pending = screen.getByRole("checkbox", { name: "Motor WEG 15HP" });
    fireEvent.click(pending);
    expect(pending).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Bomba d'água já entregue" }));
    expect(screen.getByRole("checkbox", { name: "Bomba d'água já entregue" })).not.toBeChecked();
  });

  it("renders an em_reparo row as Continua em reparo and refuses selection", () => {
    renderDeliveryPage([], [
      { id: pendingItemId, description: "Motor WEG 15HP", quantity: 1, serviceOrderStatus: "pronto" },
      { id: inRepairItemId, description: "Gerador 20kVA", quantity: 1, serviceOrderStatus: "em_reparo" },
    ]);
    expect(screen.getByText("Continua em reparo")).toBeInTheDocument();
    const inRepair = screen.getByRole("checkbox", { name: "Gerador 20kVA Continua em reparo" });
    expect(inRepair).toBeDisabled();
    expect(inRepair).not.toBeChecked();
    fireEvent.click(inRepair);
    expect(inRepair).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Motor WEG 15HP" })).toBeEnabled();
  });

  it("counts only deliverable items in the partial-selection counter", () => {
    renderDeliveryPage([], [
      { id: pendingItemId, description: "Motor WEG 15HP", quantity: 1, serviceOrderStatus: "pronto" },
      { id: secondReadyItemId, description: "Compressor 10bar", quantity: 1, serviceOrderStatus: "pronto" },
      { id: inRepairItemId, description: "Gerador 20kVA", quantity: 1, serviceOrderStatus: "em_reparo" },
    ]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Motor WEG 15HP" }));
    expect(screen.getByText("1 de 2 itens serão entregues")).toBeInTheDocument();
    expect(screen.queryByText(/de 3 itens/)).not.toBeInTheDocument();
  });
});
