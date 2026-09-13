import { z } from "zod";
import { apiErrorResponse, idempotencyKeyRequiredResponse, idempotencyKeyState, jsonBody, noStoreJson, reasonCommandSchema, reopenCollection, toLifecycleApiError, validationErrorResponse } from "@/_pages/collection-lifecycle/index.server";
import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/index.server";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/reopen">) {
  const { id } = await context.params;
  const idempotencyKeyStateResult = idempotencyKeyState(request);
  const parsed = reasonCommandSchema.safeParse(await jsonBody(request));
  if (!z.uuid().safeParse(id).success || !parsed.success || idempotencyKeyStateResult.kind === "invalid") return validationErrorResponse();
  if (idempotencyKeyStateResult.kind === "missing") return idempotencyKeyRequiredResponse();
  try {
    const result = await reopenCollection(id, parsed.data.expectedVersion, parsed.data.reason, idempotencyKeyStateResult.value);
    scheduleDocumentRenderKick(result.document.id);
    return noStoreJson(result);
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "reopen_collection");
  }
}
