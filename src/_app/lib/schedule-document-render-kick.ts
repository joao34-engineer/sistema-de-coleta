import "server-only";

import { after } from "next/server";
import { processQueuedDocumentRenders } from "@/_pages/collection-documents/api/delivery/index.server";

/** Kick PDF/QR render after the HTTP/action response. Failures stay swallowed in the worker. */
export function scheduleDocumentRenderKick(): void {
  after(() => {
    void processQueuedDocumentRenders();
  });
}
