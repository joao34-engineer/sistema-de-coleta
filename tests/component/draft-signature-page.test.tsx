import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftSignaturePage } from "@/_pages/collection-drafts/ui/draft-signature-page";
import type { DraftDTO, DraftItemDTO } from "@/_pages/collection-drafts/model/draft";

const finalizeCollectionWithSignatureAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/shared/ui/signature-pad", () => ({
  SignaturePad: ({ onSave }: { onSave?: (url: string) => void }) => (
    <button type="button" onClick={() => onSave?.("data:image/png;base64,abc")}>
      Confirmar Assinatura
    </button>
  ),
}));

vi.mock("@/app/actions/draft-flow.actions", () => ({
  finalizeCollectionWithSignatureAction,
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  fetchDraftWithItemsAction: vi.fn(),
}));

const draftId = "22222222-2222-4222-8222-222222222222";

const initialDraft: DraftDTO = {
  id: draftId,
  customerId: "44444444-4444-4444-8444-444444444444",
  collectionLocation: "Galpão Norte",
  responsibleName: "Ana Souza",
  responsibleTaxId: "52998224725",
  status: "draft",
  rowVersion: 1,
  collectedAt: null,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

const initialItems: readonly DraftItemDTO[] = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    description: "Peça A",
    quantity: 1,
    condition: null,
    notes: null,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
  },
];

describe("DraftSignaturePage", () => {
  beforeEach(() => {
    finalizeCollectionWithSignatureAction.mockReset();
  });

  afterEach(() => cleanup());

  it("maps issuer_profile_incomplete to Portuguese when finalize fails", async () => {
    finalizeCollectionWithSignatureAction.mockResolvedValue({
      ok: false,
      error: "issuer_profile_incomplete",
    });

    render(
      <DraftSignaturePage draftId={draftId} initialDraft={initialDraft} initialItems={initialItems} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Assinatura" }));
    fireEvent.click(screen.getByRole("button", { name: "Finalizar coleta" }));

    await waitFor(() => {
      expect(
        screen.getByText("Os dados do emissor da guia estão incompletos. Ajuste nas configurações."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/issuer_profile_incomplete/i)).not.toBeInTheDocument();
  });
});
