import { describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn<(task: () => void) => void>());
const processQueuedDocumentRenders = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/server", () => ({
  after: afterMock,
}));

vi.mock("@/_pages/collection-documents/api/delivery/index.server", () => ({
  processQueuedDocumentRenders,
}));

import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/api/schedule-document-render-kick";

describe("scheduleDocumentRenderKick", () => {
  it("schedules the worker after the response without awaiting it", () => {
    afterMock.mockImplementation(() => undefined);

    scheduleDocumentRenderKick();

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(processQueuedDocumentRenders).not.toHaveBeenCalled();

    const task = afterMock.mock.calls[0]?.[0];
    expect(task).toEqual(expect.any(Function));
    task?.();
    expect(processQueuedDocumentRenders).toHaveBeenCalledTimes(1);
  });
});
