import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflinePendingBanner } from "@/_app/offline/ui/offline-pending-banner";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import type { OfflineDraftRecord, OfflineMutationRecord } from "@/_pages/collection-drafts/model/offline-records";

const drain = vi.hoisted(() => vi.fn(async () => ({ officialKept: false })));
const refreshDrafts = vi.hoisted(() => vi.fn(async (): Promise<readonly OfflineDraftRecord[]> => []));
const discardLocalDraft = vi.hoisted(() =>
  vi.fn(async (): Promise<{ ok: true; officialKept?: boolean } | { ok: false; error: string }> => ({ ok: true })),
);
const listMutations = vi.hoisted(() =>
  vi.fn(async (): Promise<readonly OfflineMutationRecord[]> => []),
);
const getDraft = vi.hoisted(() => vi.fn(async (): Promise<OfflineDraftRecord | null> => null));

const draft: OfflineDraftRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: 1,
  currentStep: "itens",
  customer: {
    mode: "new",
    displayName: "Oficina Norte",
    taxId: "52998224725",
    phone: "11999999999",
    street: null,
  },
  collectionLocation: null,
  responsibleName: null,
  responsibleTaxId: null,
  collectedAt: null,
  serverRowVersion: null,
  serverCustomerId: null,
  hasServerSignature: false,
  finalizeIdempotencyKey: "33333333-3333-4333-8333-333333333333",
  syncStatus: "queued",
  lastError: null,
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-27T12:00:00.000Z",
};

vi.mock("@/_pages/collection-drafts/model/use-offline-queue-sync", () => ({
  useOfflineQueueSync: () => ({
    online: true,
    drain,
    refreshDrafts,
  }),
}));

vi.mock("@/_pages/collection-drafts/model/discard-local-draft", () => ({
  discardLocalDraft,
}));

vi.mock("@/_pages/collection-drafts/model/offline-port", () => ({
  ensureOfflineDraftStore: async () => ({
    listMutations,
    getDraft,
  }),
}));

vi.mock("@/_pages/collection-drafts/model/offline-capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/_pages/collection-drafts/model/offline-capture")>();
  return {
    ...actual,
    isBrowserOnline: () => true,
  };
});

describe("OfflinePendingBanner online drain", () => {
  beforeEach(() => {
    drain.mockClear();
    drain.mockResolvedValue({ officialKept: false });
    refreshDrafts.mockClear();
    refreshDrafts.mockResolvedValue([]);
    discardLocalDraft.mockClear();
    discardLocalDraft.mockResolvedValue({ ok: true });
    listMutations.mockReset();
    listMutations.mockResolvedValue([]);
    getDraft.mockReset();
    getDraft.mockResolvedValue(null);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("drains when the browser fires online", async () => {
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(drain).toHaveBeenCalled();
    });
    drain.mockClear();
    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      expect(drain).toHaveBeenCalled();
    });
  });

  it("shows an error when discardLocalDraft fails and keeps the row", async () => {
    refreshDrafts.mockResolvedValue([draft]);
    discardLocalDraft.mockResolvedValue({ ok: false, error: "operation_failed" });
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.discard })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.discard }));
    await waitFor(() => {
      expect(screen.getAllByText(offlineCopy.failed).length).toBeGreaterThan(0);
    });
    expect(discardLocalDraft).toHaveBeenCalled();
    expect(screen.getByText(/Oficina Norte/)).toBeInTheDocument();
  });

  it("confirms server discard when create_draft is already done", async () => {
    refreshDrafts.mockResolvedValue([draft]);
    listMutations.mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        collectionId: draft.id,
        userId: draft.userId,
        sequence: 0,
        kind: "create_draft" as const,
        payload: { draftId: draft.id },
        status: "done" as const,
        attempts: 1,
        lastError: null,
        createdAt: draft.createdAt,
      },
    ]);
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.discard })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.discard }));
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(offlineCopy.discardConfirmSynced);
    });
  });

  it("explains that the official guide was kept after a not-draft purge", async () => {
    let rows: readonly OfflineDraftRecord[] = [draft];
    refreshDrafts.mockImplementation(async () => rows);
    discardLocalDraft.mockImplementation(async () => {
      rows = [];
      return { ok: true, officialKept: true };
    });
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.discard })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.discard }));
    await waitFor(() => {
      expect(screen.getByText(offlineCopy.discardOfficialKept)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: offlineCopy.discard })).not.toBeInTheDocument();
  });

  it("shows busy retry label and maps the same issuer error after a fast failed retry", async () => {
    const issuerDraft = { ...draft, lastError: "issuer_profile_incomplete" };
    refreshDrafts
      .mockResolvedValueOnce([issuerDraft])
      .mockResolvedValueOnce([issuerDraft])
      .mockResolvedValue([issuerDraft]);
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    expect(screen.getByRole("button", { name: offlineCopy.retryBusy })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByText("Os dados do emissor da guia estão incompletos. Ajuste nas configurações.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: offlineCopy.retry })).not.toBeDisabled();
  });

  it("shows Falha ao sincronizar when retry leaves the draft without a lastError", async () => {
    refreshDrafts.mockResolvedValue([draft]);
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    await waitFor(() => {
      expect(screen.getByText(offlineCopy.failed)).toBeInTheDocument();
    });
    expect(screen.getByText(/Oficina Norte/)).toBeInTheDocument();
  });

  it("hides the blocking panel on Fechar and keeps the draft", async () => {
    refreshDrafts.mockResolvedValue([draft]);
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.closePanel })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.closePanel }));
    expect(screen.queryByText(offlineCopy.pendingTitle)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: offlineCopy.showPending })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: offlineCopy.discard })).not.toBeInTheDocument();
  });

  it("shows sync complete when the queue clears after retry", async () => {
    let clearQueue = false;
    refreshDrafts.mockImplementation(async () => (clearQueue ? [] : [draft]));
    render(
      <OfflinePendingBanner actor={{ userId: "11111111-1111-4111-8111-111111111111", organizationId: 1 }} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: offlineCopy.retry })).toBeInTheDocument();
    });
    clearQueue = true;
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    await waitFor(() => {
      expect(screen.getByText(offlineCopy.syncComplete)).toBeInTheDocument();
    });
  });
});
