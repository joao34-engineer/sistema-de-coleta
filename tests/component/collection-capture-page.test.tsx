import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { offlineDatabaseSchema, type OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";
import { ensureOfflineDraftStore, resetOfflinePortForTests, setOfflinePortForTests } from "@/_pages/collection-drafts/model/offline-port";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";

const { fetchDraftWithItemsAction, collectionExistsAction, getCustomerAction, runAuthenticatedDrain } = vi.hoisted(() => ({
  fetchDraftWithItemsAction: vi.fn(),
  collectionExistsAction: vi.fn(async () => false),
  getCustomerAction: vi.fn(),
  runAuthenticatedDrain: vi.fn(async () => ({ officialKept: false })),
}));

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";
const customerId = "44444444-4444-4444-8444-444444444444";

const localDraft: OfflineDraftRecord = {
  id: collectionId,
  userId: actor.userId,
  organizationId: 1,
  currentStep: "assinatura",
  customer: {
    mode: "existing",
    customerId,
    displayName: "Oficina Norte",
    taxId: "52998224725",
    phone: "11998765432",
    street: null,
  },
  collectionLocation: "Rua da Oficina, 100",
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  serverRowVersion: 4,
  serverCustomerId: customerId,
  hasServerSignature: false,
  finalizeIdempotencyKey: "33333333-3333-4333-8333-333333333333",
  syncStatus: "queued",
  lastError: null,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/coletas/22222222-2222-4222-8222-222222222222/assinatura",
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  fetchDraftWithItemsAction,
  collectionExistsAction,
}));

vi.mock("@/app/actions/draft-flow.actions", () => ({
  getCustomerAction,
}));

vi.mock("@/_pages/collection-drafts/model/run-authenticated-drain", () => ({
  runAuthenticatedDrain,
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  return {
    ...actual,
    isBrowserOnline: () => true,
  };
});

vi.mock("@/shared/ui/signature-pad", () => ({
  SignaturePad: ({ onSave }: { onSave?: (url: string) => void }) => (
    <button type="button" onClick={() => onSave?.("data:image/png;base64,aaa")}>
      Confirmar assinatura
    </button>
  ),
}));

describe("CollectionCapturePage leftovers", () => {
  beforeEach(() => {
    fetchDraftWithItemsAction.mockReset();
    getCustomerAction.mockReset();
    runAuthenticatedDrain.mockReset();
    runAuthenticatedDrain.mockResolvedValue({ officialKept: false });
    setOfflinePortForTests(createMemoryOfflinePort(offlineDatabaseSchema));
  });

  afterEach(() => {
    cleanup();
    resetOfflinePortForTests();
    resetOfflineSnapshotForTests();
  });

  it("does not leave the items wizard usable when hydrate aborts", async () => {
    fetchDraftWithItemsAction.mockResolvedValue({
      ok: true,
      draft: {
        id: collectionId,
        customerId,
        status: "draft",
        collectionLocation: null,
        responsibleName: null,
        responsibleTaxId: null,
        collectedAt: null,
        rowVersion: 1,
        createdAt: "2026-08-27T12:00:00.000Z",
        updatedAt: "2026-08-27T12:00:00.000Z",
      },
      items: [],
      hasSignature: false,
    });
    getCustomerAction.mockResolvedValue({
      ok: true,
      customer: {
        id: customerId,
        displayName: "Cliente",
        taxId: "00000000000",
        phone: "11000000000",
        address: null,
      },
    });

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);

    await waitFor(() => {
      expect(screen.getAllByText(offlineCopy.hydrateCustomerFailed).length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("button", { name: /\+ Adicionar item/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar coleta" })).not.toBeInTheDocument();

    const store = await ensureOfflineDraftStore();
    const leftover = await store.getDraft(collectionId, actor.userId);
    expect(leftover).toBeNull();
    expect(JSON.stringify({ leftover, storeDump: leftover })).not.toContain("00000000000");
  });

  it("shows online finalize error instead of saved-locally when drain leaves leftover", async () => {
    const store = await ensureOfflineDraftStore();
    await store.putDraft(localDraft);

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="assinatura" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar assinatura" }));
    fireEvent.change(screen.getByLabelText("Nome de quem assinou *"), { target: { value: "Ana Souza" } });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ de quem assinou *"), { target: { value: "52998224725" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar coleta" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
    });
    expect(screen.queryByText(offlineCopy.savedLocally)).not.toBeInTheDocument();
    expect(screen.queryByText("Salvo neste aparelho")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
  });
});
