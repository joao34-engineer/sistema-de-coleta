import { z } from "zod";
import { deliveryErrorResponse, retryDocumentJob } from "@/_pages/collection-documents/api/delivery/index.server";
import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/api/schedule-document-render-kick";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/collections/[id]/documents/[documentId]/retry">) {
  const { id, documentId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(documentId).success) {
    return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  }
  try {
    const data = await retryDocumentJob(id, documentId);
    if (!data.alreadyReady) {
      scheduleDocumentRenderKick(documentId);
    }
    return noStoreJson({ data }, { status: 200 });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
