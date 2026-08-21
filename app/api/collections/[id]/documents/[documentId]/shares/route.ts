import { z } from "zod";
import { createDocumentShare, deliveryErrorResponse, shareCreateSchema } from "@/_pages/collection-documents/api/delivery/index.server";
import { jsonBody, noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/documents/[documentId]/shares">) {
  const { documentId } = await context.params;
  const parsed = shareCreateSchema.safeParse(await jsonBody(request));
  if (!z.uuid().safeParse(documentId).success || !parsed.success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    return noStoreJson({ data: await createDocumentShare(documentId, parsed.data) }, { status: 201 });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}

