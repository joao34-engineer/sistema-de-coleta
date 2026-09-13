import { z } from "zod";
import { deliveryErrorResponse, revokeDocumentShare } from "@/_pages/collection-documents/index.server";
import { noStoreJson } from "@/_pages/collection-lifecycle/index.server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/documents/shares/[shareId]/revoke">) {
  const { shareId } = await context.params;
  if (!z.uuid().safeParse(shareId).success) return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  try {
    return noStoreJson({ data: await revokeDocumentShare(shareId) });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
