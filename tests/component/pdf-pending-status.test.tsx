import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfPendingStatus } from "@/_pages/collection-documents/ui/pdf-pending-status";
import { offlineCopy } from "@/_pages/collection-drafts/model/offline-copy";

const collectionId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("PdfPendingStatus", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    router.refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("keeps the generating copy until polls are exhausted, then offers retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: "queued", alreadyReady: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <PdfPendingStatus
        collectionId={collectionId}
        documentId={documentId}
        hasPdf={false}
        pdfJobStatus="queued"
        refreshMs={10}
        maxRefreshes={1}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF da guia/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/O PDF ainda está na fila/i);
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/collections/${collectionId}/documents/${documentId}/retry`,
      { method: "POST" },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows honest failure and retry instead of generating copy", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: "queued", alreadyReady: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PdfPendingStatus
        collectionId={collectionId}
        documentId={documentId}
        hasPdf={false}
        pdfJobStatus="failed"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível gerar o PDF/i);
    expect(screen.queryByText(/Gerando o PDF da guia/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: offlineCopy.retry }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/collections/${collectionId}/documents/${documentId}/retry`,
      { method: "POST" },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
