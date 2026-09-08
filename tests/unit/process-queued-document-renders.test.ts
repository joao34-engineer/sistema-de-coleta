import { describe, expect, it, vi } from "vitest";
import { processQueuedDocumentRenders } from "@/_pages/collection-documents/api/delivery/worker.server";

describe("processQueuedDocumentRenders", () => {
  it("asks the worker for a pdf+qr batch", async () => {
    const runBatch = vi.fn().mockResolvedValue({ processed: 1, statuses: ["succeeded", "idle"] });
    await processQueuedDocumentRenders(runBatch);
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(runBatch).toHaveBeenCalledWith(2);
  });

  it("keeps claiming while a full batch succeeds so leftover jobs do not skip the new guia", async () => {
    const runBatch = vi
      .fn()
      .mockResolvedValueOnce({ processed: 2, statuses: ["succeeded", "succeeded"] })
      .mockResolvedValueOnce({ processed: 2, statuses: ["succeeded", "succeeded"] })
      .mockResolvedValueOnce({ processed: 0, statuses: ["idle"] });
    await processQueuedDocumentRenders(runBatch);
    expect(runBatch).toHaveBeenCalledTimes(3);
  });

  it("stops after the kick round cap even if the queue still looks full", async () => {
    const runBatch = vi.fn().mockResolvedValue({ processed: 2, statuses: ["succeeded", "succeeded"] });
    await processQueuedDocumentRenders(runBatch);
    expect(runBatch).toHaveBeenCalledTimes(4);
  });

  it("swallows worker failures so finalize stays committed", async () => {
    const runBatch = vi.fn().mockRejectedValue(new Error("document_verification_base_url_missing"));
    await expect(processQueuedDocumentRenders(runBatch)).resolves.toBeUndefined();
  });
});
