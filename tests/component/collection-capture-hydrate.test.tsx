import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import { offlineDatabaseSchema } from "@/_pages/collection-drafts/model/offline-records";
import { ensureOfflineDraftStore, resetOfflinePortForTests, setOfflinePortForTests } from "@/_pages/collection-drafts/model/offline-port";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";
import type { DraftDTO } from "@/_pages/collection-drafts/model/draft";

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";
const customerId = "44444444-4444-4444-8444-444444444444";

const fetchDraftWithItemsAction = vi.hoisted(() => vi.fn());
const getCustomerAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/22222222-2222-4222-8222-222222222222/itens",
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  fetchDraftWithItemsAction: (id: string) => fetchDraftWithItemsAction(id),
}));

vi.mock("@/app/actions/draft-flow.actions", () => ({
  getCustomerAction: (id: string) => getCustomerAction(id),
  searchCustomersAction: vi.fn(),
}));

vi.mock("@/_pages/collection-drafts/model/run-authenticated-drain", () => ({
  runAuthenticatedDrain: vi.fn(async () => ({ officialKept: false })),
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  return {
    ...actual,
    isBrowserOnline: () => true,
  };
});

const remoteDraft: DraftDTO = {
  id: collectionId,
  customerId,
  status: "draft",
  collectionLocation: "Rua da Oficina",
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  rowVersion: 3,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

async function assertWizardBlocked(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: offlineCopy.hydrateCustomerFailed })).toBeInTheDocument();
  });
  expect(screen.queryByRole("button", { name: /Adicionar item/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Registre tudo o que foi entregue.")).not.toBeInTheDocument();
  const store = await ensureOfflineDraftStore();
  const persisted = await store.getDraft(collectionId, actor.userId);
  expect(persisted).toBeNull();
}

describe("CollectionCapturePage hydrate abort", () => {
  beforeEach(() => {
    setOfflinePortForTests(createMemoryOfflinePort(offlineDatabaseSchema));
    fetchDraftWithItemsAction.mockReset();
    getCustomerAction.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetOfflinePortForTests();
    resetOfflineSnapshotForTests();
  });

  it("blocks the items wizard when the remote draft has no customer", async () => {
    fetchDraftWithItemsAction.mockResolvedValue({
      ok: true,
      draft: { ...remoteDraft, customerId: null },
      items: [],
      hasSignature: false,
    });

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);
    await assertWizardBlocked();
    expect(getCustomerAction).not.toHaveBeenCalled();
  });

  it("blocks the items wizard when getCustomerAction fails", async () => {
    fetchDraftWithItemsAction.mockResolvedValue({
      ok: true,
      draft: remoteDraft,
      items: [],
      hasSignature: false,
    });
    getCustomerAction.mockResolvedValue({ ok: false, error: "not_found" });

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);
    await assertWizardBlocked();
  });

  it("blocks the items wizard and does not persist a placeholder CPF", async () => {
    fetchDraftWithItemsAction.mockResolvedValue({
      ok: true,
      draft: remoteDraft,
      items: [],
      hasSignature: false,
    });
    getCustomerAction.mockResolvedValue({
      ok: true,
      customer: {
        id: customerId,
        displayName: "Oficina Norte",
        taxId: "00000000000",
        phone: "11998765432",
        address: null,
      },
    });

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);
    await assertWizardBlocked();
    const store = await ensureOfflineDraftStore();
    const rows = await store.listDrafts(actor.userId);
    expect(JSON.stringify(rows)).not.toContain("00000000000");
  });
});
