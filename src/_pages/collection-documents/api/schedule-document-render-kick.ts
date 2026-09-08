import "server-only";

import { after } from "next/server";
import { processQueuedDocumentRenders } from "@/_pages/collection-documents/api/delivery/index.server";

/** Kick PDF/QR after the response. Must return the worker Promise so Vercel waitUntil keeps the isolate alive. */
export function scheduleDocumentRenderKick(): void {
  after(async () => {
    await processQueuedDocumentRenders();
  });
}
