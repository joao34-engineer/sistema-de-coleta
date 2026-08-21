import { z } from "zod";
import { deliveryErrorResponse, emailShareSchema, queueDocumentShareEmail } from "@/_pages/collection-documents/api/delivery/index.server";
import { idempotencyKeyState, jsonBody, noStoreJson } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/documents/[documentId]/shares/email">) {
  const { documentId } = await context.params;
  const parsed = z.object({ shareId: z.uuid(), ...emailShareSchema.shape }).strict().safeParse(await jsonBody(request));
  const idempotency = idempotencyKeyState(request);
  if (!z.uuid().safeParse(documentId).success || !parsed.success || idempotency.kind === "invalid") return noStoreJson({ error: { code: "validation_error", message: "Revise os dados enviados." } }, { status: 422 });
  if (idempotency.kind === "missing") return noStoreJson({ error: { code: "idempotency_key_required", message: "Informe o cabeçalho Idempotency-Key." } }, { status: 400 });
  try {
    return noStoreJson({ data: await queueDocumentShareEmail(parsed.data.shareId, { email: parsed.data.email, shareToken: parsed.data.shareToken }, idempotency.value, documentId) });
  } catch (error: unknown) {
    const safe = deliveryErrorResponse(error);
    return noStoreJson({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
