import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryOfflinePort } from "@/shared/lib/offline";
import { CollectionCapturePage } from "@/_pages/collection-drafts/ui/collection-capture-page";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import {
  offlineDatabaseSchema,
  type OfflineDraftRecord,
  type OfflineItemRecord,
} from "@/_pages/collection-drafts/model/offline-records";
import { ensureOfflineDraftStore, resetOfflinePortForTests, setOfflinePortForTests } from "@/_pages/collection-drafts/model/offline-port";
import { resetOfflineSnapshotForTests } from "@/_pages/collection-drafts/model/offline-snapshot";

const { replace, setDraftStepMock, realSetDraftStep } = vi.hoisted(() => ({
  replace: vi.fn(),
  setDraftStepMock: vi.fn(),
  realSetDraftStep: {
    current: null as null | typeof import("@/_pages/collection-drafts/model/offline-capture").setDraftStep,
  },
}));

const actor = { userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 };
const collectionId = "22222222-2222-4222-8222-222222222222";
const customerId = "44444444-4444-4444-8444-444444444444";
const itemId = "55555555-5555-4555-8555-555555555555";

const sampleItem: OfflineItemRecord = {
  id: itemId,
  collectionId,
  userId: actor.userId,
  description: "Motor usado",
  quantity: 1,
  condition: "Usado",
  notes: null,
  removed: false,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

const itensDraft: OfflineDraftRecord = {
  id: collectionId,
  userId: actor.userId,
  organizationId: 1,
  currentStep: "itens",
  customer: {
    mode: "existing",
    customerId,
    displayName: "Oficina Norte",
    taxId: "52998224725",
    phone: "11998765432",
    street: null,
  },
  collectionLocation: "Rua da Oficina",
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
    replace,
  }),
  usePathname: () => `/coletas/${collectionId}/itens`,
}));

vi.mock("@/_pages/collection-drafts/api/actions", () => ({
  fetchDraftWithItemsAction: vi.fn(),
  collectionExistsAction: vi.fn(async () => false),
}));

vi.mock("@/app/actions/draft-flow.actions", () => ({
  getCustomerAction: vi.fn(),
}));

vi.mock("@/_pages/collection-drafts/model/run-authenticated-drain", () => ({
  runAuthenticatedDrain: vi.fn(async () => ({ officialKept: false })),
  runAuthenticatedDrainCollection: vi.fn(async () => ({ status: "completed", officialKept: false })),
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  realSetDraftStep.current = actual.setDraftStep;
  return {
    ...actual,
    isBrowserOnline: () => true,
    setDraftStep: (...args: Parameters<typeof actual.setDraftStep>) => setDraftStepMock(...args),
  };
});

describe("CollectionCapturePage optimistic step", () => {
  beforeEach(async () => {
    replace.mockReset();
    setDraftStepMock.mockReset();
    setDraftStepMock.mockImplementation((...args: Parameters<NonNullable<typeof realSetDraftStep.current>>) => {
      const impl = realSetDraftStep.current;
      if (impl === null) {
        throw new Error("real setDraftStep was not captured");
      }
      return impl(...args);
    });
    setOfflinePortForTests(createMemoryOfflinePort(offlineDatabaseSchema));
    const store = await ensureOfflineDraftStore();
    await store.putDraft(itensDraft);
    await store.putItem(sampleItem);
  });

  afterEach(() => {
    cleanup();
    resetOfflinePortForTests();
    resetOfflineSnapshotForTests();
  });

  it("paints revisão before a slow setDraftStep resolves", async () => {
    setDraftStepMock.mockImplementation(() => new Promise(() => {}));

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revisar coleta" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar coleta" }));

    await waitFor(() => {
      expect(screen.getByText("Confira antes de emitir.")).toBeInTheDocument();
    });
    expect(replace).toHaveBeenCalledWith(`/coletas/${collectionId}/revisao`);
  });

  it("rolls back the step and URL when setDraftStep fails", async () => {
    setDraftStepMock.mockRejectedValue(new Error("quota"));

    render(<CollectionCapturePage actor={actor} resumeDraftId={collectionId} initialStep="itens" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Revisar coleta" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar coleta" }));

    await waitFor(() => {
      expect(screen.getByText(offlineCopy.stepPersistFailed)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Revisar coleta" })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(`/coletas/${collectionId}/itens`);
  });
});
