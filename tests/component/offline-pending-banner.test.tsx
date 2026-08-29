import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflinePendingPanel } from "@/_app/offline/ui/offline-pending-panel";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";
import type { OfflineDraftRecord } from "@/_pages/collection-drafts/model/offline-records";

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

describe("OfflinePendingPanel", () => {
  afterEach(() => cleanup());

  it("lists a pending local draft with resume and retry", () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    render(<OfflinePendingPanel drafts={[draft]} busy={false} onRetry={onRetry} onDiscard={onDiscard} />);

    expect(screen.getByText(offlineCopy.pendingTitle)).toBeInTheDocument();
    expect(screen.getByText(/Oficina Norte/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: offlineCopy.resume })).toHaveAttribute(
      "href",
      "/coletas/nova?rascunho=22222222-2222-4222-8222-222222222222",
    );
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
