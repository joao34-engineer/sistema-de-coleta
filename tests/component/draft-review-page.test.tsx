import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftReviewPage } from "@/_pages/collection-drafts/ui/draft-review-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/coletas/22222222-2222-4222-8222-222222222222/revisao",
}));

const item = { id: "55555555-5555-4555-8555-555555555555", description: "Motor usado" };

describe("DraftReviewPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders required props without a loading fetch and disables emit when location is empty", () => {
    render(
      <DraftReviewPage
        draftId="22222222-2222-4222-8222-222222222222"
        customerName="Oficina Norte"
        customerTaxId="52998224725"
        items={[item]}
        collectionLocation={null}
        syncState="queued"
        lastError={null}
        onPersistLocation={vi.fn(async () => undefined)}
        onBackToItems={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.queryByText("Carregando revisão...")).not.toBeInTheDocument();
    expect(screen.getByText("Oficina Norte")).toBeInTheDocument();
    expect(screen.getByText("Motor usado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir guia e coletar assinatura" })).toBeDisabled();
  });

  it("persists location on blur and continues after emit", async () => {
    const onPersistLocation = vi.fn(async () => undefined);
    const onContinue = vi.fn(async () => undefined);

    render(
      <DraftReviewPage
        draftId="22222222-2222-4222-8222-222222222222"
        customerName="Oficina Norte"
        customerTaxId="52998224725"
        items={[item]}
        collectionLocation={null}
        syncState="queued"
        lastError={null}
        onPersistLocation={onPersistLocation}
        onBackToItems={vi.fn()}
        onContinue={onContinue}
      />,
    );

    const locationInput = screen.getByLabelText("Local da coleta *");
    fireEvent.change(locationInput, { target: { value: "Pátio externo, bloco B" } });
    fireEvent.blur(locationInput);

    await waitFor(() => {
      expect(onPersistLocation).toHaveBeenCalledWith("Pátio externo, bloco B");
    });

    fireEvent.click(screen.getByRole("button", { name: "Emitir guia e coletar assinatura" }));

    await waitFor(() => {
      expect(onContinue).toHaveBeenCalledTimes(1);
    });
  });
});
