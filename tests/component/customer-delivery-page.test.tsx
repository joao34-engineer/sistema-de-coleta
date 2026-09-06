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

function renderDeliveryPage(
  alreadyDeliveredItemIds: ReadonlyArray<string> = [deliveredItemId],
): void {
  render(
    <CustomerDeliveryPage
      collectionId="33333333-3333-4333-8333-333333333333"
      officialCode="MJT-2026-000099"
      items={[
        { id: pendingItemId, description: "Motor WEG 15HP", quantity: 1 },
        { id: deliveredItemId, description: "Bomba d'água", quantity: 2 },
      ]}
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
});
