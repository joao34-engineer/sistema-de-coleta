import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkshopCheckInPage } from "@/_pages/collection-operations/ui/workshop-checkin-page";

const workshopCheckInAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/11111111-1111-4111-8111-111111111111/oficina/checkin",
}));

vi.mock("@/_pages/collection-operations/api/actions", () => ({
  workshopCheckInAction: (...args: unknown[]) => workshopCheckInAction(...args),
}));

vi.mock("@/shared/ui/signature-pad", () => ({
  SignaturePad: ({ onSave }: { onSave?: (url: string) => void }) => (
    <button type="button" onClick={() => onSave?.("data:image/png;base64,aaa")}>
      Confirmar assinatura
    </button>
  ),
}));

const itemA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function renderCheckInPage(): void {
  render(
    <WorkshopCheckInPage
      collectionId="11111111-1111-4111-8111-111111111111"
      officialCode="MJT-2026-000099"
      collectionItems={[
        { id: itemA, description: "Máquina de costura", quantity: 1 },
        { id: itemB, description: "Ferro industrial", quantity: 1 },
      ]}
      rowVersion={1}
    />,
  );
}

describe("WorkshopCheckInPage (PR 5 O02b)", () => {
  afterEach(() => {
    cleanup();
    workshopCheckInAction.mockReset();
  });

  it("renders three arrival segments and the O02b counter", () => {
    renderCheckInPage();
    expect(screen.getAllByRole("radio", { name: "Conferido" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "Divergência" })).toHaveLength(2);
    expect(screen.getAllByRole("radio", { name: "Não chegou" })).toHaveLength(2);
    expect(screen.getByText("Recebidos 2 de 2 · 0 não chegou")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conferir item a item" })).toBeInTheDocument();
  });

  it("locks qty to 0 and requires a motivo before submit when Não chegou is active", () => {
    renderCheckInPage();
    const missingButtons = screen.getAllByRole("radio", { name: "Não chegou" });
    expect(missingButtons).toHaveLength(2);
    const ferroMissing = missingButtons[1];
    if (ferroMissing === undefined) {
      throw new Error("expected Não chegou radio for the second item");
    }
    fireEvent.click(ferroMissing);
    expect(screen.getByText("Recebidos 1 de 2 · 1 não chegou")).toBeInTheDocument();
    expect(screen.getByText("Este item permanece na guia; não entra em orçamento, progresso nem entrega.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome do administrador *"), {
      target: { value: "Maria Souza" },
    });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do administrador *"), {
      target: { value: "52998224725" },
    });
    const conditionInputs = screen.getAllByLabelText("Condição observada");
    for (const input of conditionInputs) {
      fireEvent.change(input, { target: { value: "sem avarias" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Confirmar assinatura" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }));
    expect(screen.getByText("Informe o motivo de o item não ter chegado.")).toBeInTheDocument();
    expect(workshopCheckInAction).not.toHaveBeenCalled();
  });

  it("sends missing payload with qty 0 and nao_recebido", async () => {
    workshopCheckInAction.mockResolvedValue({ ok: true });
    renderCheckInPage();
    const missingButtons = screen.getAllByRole("radio", { name: "Não chegou" });
    expect(missingButtons).toHaveLength(2);
    const ferroMissing = missingButtons[1];
    if (ferroMissing === undefined) {
      throw new Error("expected Não chegou radio for the second item");
    }
    fireEvent.click(ferroMissing);
    fireEvent.change(screen.getByLabelText("Motivo / observações *"), {
      target: { value: "Não veio na carga" },
    });
    fireEvent.change(screen.getByLabelText("Nome do administrador *"), {
      target: { value: "Maria Souza" },
    });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ do administrador *"), {
      target: { value: "52998224725" },
    });
    const conditionInputs = screen.getAllByLabelText("Condição observada");
    for (const input of conditionInputs) {
      fireEvent.change(input, { target: { value: "sem avarias" } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Confirmar assinatura" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }));
    await vi.waitFor(() => {
      expect(workshopCheckInAction).toHaveBeenCalled();
    });
    const formData = workshopCheckInAction.mock.calls[0]?.[1] as FormData;
    const items = JSON.parse(String(formData.get("items"))) as ReadonlyArray<{
      itemId: string;
      arrivalStatus: string;
      quantityObserved: number;
      conditionObserved: string;
      divergenceNotes: string | null;
    }>;
    const missing = items.find((item) => item.itemId === itemB);
    expect(missing).toMatchObject({
      arrivalStatus: "missing",
      quantityObserved: 0,
      conditionObserved: "nao_recebido",
      divergenceNotes: "Não veio na carga",
    });
    const arrived = items.find((item) => item.itemId === itemA);
    expect(arrived).toMatchObject({
      arrivalStatus: "arrived",
      quantityObserved: 1,
    });
  });
});
