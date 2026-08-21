import { z } from "zod";
import { listCollectionDocuments, deliveryErrorResponse } from "@/_pages/collection-documents/api/delivery/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/collections/[id]/documents">) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    return noStoreJson({ data: { documents: await listCollectionDocuments(id) } });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
