import { describe, expect, it, vi } from "vitest";
import { processQueuedDocumentRenders } from "@/_pages/collection-documents/api/delivery/worker.server";

const documentId = "11111111-1111-4111-8111-111111111111";

describe("processQueuedDocumentRenders", () => {
  it("asks the worker for a pdf+qr batch of this document", async () => {
    const runBatch = vi.fn().mockResolvedValue({ processed: 2, statuses: ["succeeded", "succeeded"] });
    await processQueuedDocumentRenders(documentId, runBatch);
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(runBatch).toHaveBeenCalledWith(2, documentId);
  });

  it("keeps the global FIFO batch when no document id is passed (cron)", async () => {
    const runBatch = vi.fn().mockResolvedValue({ processed: 1, statuses: ["succeeded", "idle"] });
    await processQueuedDocumentRenders(undefined, runBatch);
    expect(runBatch).toHaveBeenCalledWith(2, undefined);
  });

  it("swallows worker failures so finalize stays committed", async () => {
    const runBatch = vi.fn().mockRejectedValue(new Error("document_verification_base_url_missing"));
    await expect(processQueuedDocumentRenders(documentId, runBatch)).resolves.toBeUndefined();
  });
});
