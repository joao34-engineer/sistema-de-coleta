import { deliveryErrorResponse, reviseCollectionDocument, revisionSchema, scheduleDocumentRenderKick } from "@/_pages/collection-documents/index.server";
import { idempotencyKeyState, jsonBody, noStoreJson } from "@/_pages/collection-lifecycle/index.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/documents/[documentId]/revisions">) {
  const { documentId } = await context.params;
  const parsed = revisionSchema.safeParse(await jsonBody(request));
  const idempotency = idempotencyKeyState(request);
  if (!parsed.success || parsed.data.sourceDocumentId !== documentId || idempotency.kind === "invalid") return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  if (idempotency.kind === "missing") return noStoreJson({ error: { code: "idempotency_key_required", message: "Informe o cabeçalho Idempotency-Key." } }, { status: 400 });
  try {
    const data = await reviseCollectionDocument(parsed.data, idempotency.value);
    scheduleDocumentRenderKick(data.document.id);
    return noStoreJson({ data }, { status: 201 });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
