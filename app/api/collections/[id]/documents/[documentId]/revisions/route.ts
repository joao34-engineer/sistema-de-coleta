import { deliveryErrorResponse, reviseCollectionDocument, revisionSchema } from "@/_pages/collection-documents/api/delivery/index.server";
import { idempotencyKeyState, jsonBody, noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/documents/[documentId]/revisions">) {
  const { id, documentId } = await context.params;
  const parsed = revisionSchema.safeParse(await jsonBody(request));
  const idempotency = idempotencyKeyState(request);
  if (!parsed.success || !/^[0-9a-f-]{36}$/.test(id) || documentId !== parsed.data.sourceDocumentId || idempotency.kind === "invalid") return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  if (idempotency.kind === "missing") return noStoreJson({ error: { code: "idempotency_key_required", message: "Informe o cabeçalho Idempotency-Key." } }, { status: 400 });
  try {
    return noStoreJson({ data: await reviseCollectionDocument(parsed.data, idempotency.value) }, { status: 201 });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
