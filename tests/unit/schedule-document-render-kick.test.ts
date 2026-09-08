import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn<(task: () => void | Promise<void>) => void>());
const processQueuedDocumentRenders = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/server", () => ({
  after: afterMock,
}));

vi.mock("@/_pages/collection-documents/api/delivery/index.server", () => ({
  processQueuedDocumentRenders,
}));

import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/api/schedule-document-render-kick";

describe("scheduleDocumentRenderKick", () => {
  beforeEach(() => {
    afterMock.mockClear();
    processQueuedDocumentRenders.mockClear();
    afterMock.mockImplementation(() => undefined);
  });

  it("schedules an after() task that returns the worker promise", async () => {
    afterMock.mockImplementation(() => undefined);

    scheduleDocumentRenderKick();

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(processQueuedDocumentRenders).not.toHaveBeenCalled();

    const task = afterMock.mock.calls[0]?.[0];
    expect(task).toEqual(expect.any(Function));
    const pending = task?.();
    expect(pending).toBeInstanceOf(Promise);
    await pending;
    expect(processQueuedDocumentRenders).toHaveBeenCalledTimes(1);
    expect(processQueuedDocumentRenders).toHaveBeenCalledWith(undefined);
  });

  it("passes the document id so leftover FIFO jobs cannot steal the kick", async () => {
    const documentId = "11111111-1111-4111-8111-111111111111";
    scheduleDocumentRenderKick(documentId);
    const task = afterMock.mock.calls[0]?.[0];
    await task?.();
    expect(processQueuedDocumentRenders).toHaveBeenCalledWith(documentId);
  });
});
