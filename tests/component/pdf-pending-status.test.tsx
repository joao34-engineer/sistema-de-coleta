import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfPendingStatus } from "@/_pages/collection-documents/ui/pdf-pending-status";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("PdfPendingStatus", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the generating copy until polls are exhausted", async () => {
    vi.useFakeTimers();
    render(<PdfPendingStatus pending refreshMs={10} maxRefreshes={1} />);

    expect(screen.getByRole("status")).toHaveTextContent(/Gerando o PDF da guia/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/O PDF ainda está sendo processado/i);
  });
});
