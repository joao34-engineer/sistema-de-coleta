import { describe, expect, it, vi } from "vitest";
import { processQueuedDocumentRenders } from "@/_pages/collection-documents/api/delivery/worker.server";

describe("processQueuedDocumentRenders", () => {
  it("asks the worker for a pdf+qr batch", async () => {
    const runBatch = vi.fn().mockResolvedValue({ processed: 2, statuses: ["succeeded", "succeeded"] });
    await processQueuedDocumentRenders(runBatch);
    expect(runBatch).toHaveBeenCalledWith(2);
  });

  it("swallows worker failures so finalize stays committed", async () => {
    const runBatch = vi.fn().mockRejectedValue(new Error("document_verification_base_url_missing"));
    await expect(processQueuedDocumentRenders(runBatch)).resolves.toBeUndefined();
  });
});
