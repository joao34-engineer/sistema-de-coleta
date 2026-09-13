import { z } from "zod";
import { deliveryErrorResponse, listCollectionDocuments } from "@/_pages/collection-documents/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/index.server";

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
