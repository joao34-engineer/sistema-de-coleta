import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { resetOfflinePortForTests, setOfflinePortForTests } from "@/_pages/collection-drafts/model/offline-port";
import { ensureOfflineDraftStore } from "@/_pages/collection-drafts/model/offline-port";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/22222222-2222-4222-8222-222222222222/assinatura",
}));

vi.mock("@/shared/ui/signature-pad", () => ({
  SignaturePad: ({ onSave }: { onSave?: (url: string) => void }) => (
    <button type="button" onClick={() => onSave?.("data:image/png;base64,abc")}>
      Confirmar Assinatura
    </button>
  ),
}));

vi.mock("@/_pages/collection-drafts/model/run-authenticated-drain", () => ({
  runAuthenticatedDrain: vi.fn(async () => ({ officialKept: false })),
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  fetchDraftWithItemsAction: vi.fn(),
  collectionExistsAction: vi.fn(async () => false),
}));

vi.mock("@/app/actions/draft-flow.actions", () => ({
  getCustomerAction: vi.fn(),
  searchCustomersAction: vi.fn(),
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  return {
    ...actual,
    isBrowserOnline: () => true,
  };
});

const draft: OfflineDraftRecord = {
  id: collectionId,
  userId: actor.userId,
  organizationId: 1,
  currentStep: "assinatura",
  customer: {
    mode: "new",
    displayName: "Oficina Norte",
    taxId: "52998224725",
    phone: "11999999999",
    street: null,
  },
  collectionLocation: "Rua da Oficina",
  responsibleName: "Ana Souza",
  responsibleTaxId: "52998224725",
  collectedAt: null,
  serverRowVersion: 1,
  serverCustomerId: "44444444-4444-4444-8444-444444444444",
  hasServerSignature: false,
  finalizeIdempotencyKey: "33333333-3333-4333-8333-333333333333",
  syncStatus: "queued",
  lastError: "operation_failed",
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

describe("CollectionCapturePage finalize online leftover", () => {
  beforeEach(() => {
    setOfflinePortForTests(createMemoryOfflinePort(offlineDatabaseSchema));
  });

  afterEach(() => {
    cleanup();
    resetOfflinePortForTests();
    resetOfflineSnapshotForTests();
  });

  it("does not show Salvo neste aparelho when online drain leaves a leftover", async () => {
    const store = await ensureOfflineDraftStore();
    await store.putDraft(draft);

    render(
      <CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="assinatura" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Assinatura" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar coleta" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: offlineCopy.failed })).toBeInTheDocument();
    });
    expect(screen.queryByText("Salvo neste aparelho")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
  });

  it("keeps invalid CPF on the assinatura form instead of Falha ao sincronizar", async () => {
    const store = await ensureOfflineDraftStore();
    await store.putDraft({ ...draft, lastError: null, syncStatus: "synced" });

    render(
      <CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="assinatura" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Assinatura" }));
    const taxId = screen.getByLabelText("CPF/CNPJ de quem assinou *");
    fireEvent.change(taxId, { target: { value: "11111111111" } });

    await waitFor(() => {
      expect(screen.getByText("CPF inválido, revise e tente novamente.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: offlineCopy.failed })).not.toBeInTheDocument();
  });
});
