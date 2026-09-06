import { z } from "zod";
import { criticalCommandSchema, finalizeCollection, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { scheduleDocumentRenderKick } from "@/_pages/collection-documents/api/schedule-document-render-kick";
import { apiErrorResponse, idempotencyKeyRequiredResponse, idempotencyKeyState, jsonBody, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/finalize">) {
  const { id } = await context.params;
  const idempotencyKeyStateResult = idempotencyKeyState(request);
  const parsed = criticalCommandSchema.safeParse(await jsonBody(request));
  if (!z.uuid().safeParse(id).success || !parsed.success || idempotencyKeyStateResult.kind === "invalid") return validationErrorResponse();
  if (idempotencyKeyStateResult.kind === "missing") return idempotencyKeyRequiredResponse();
  try {
    const result = await finalizeCollection(id, parsed.data.expectedVersion, idempotencyKeyStateResult.value);
    scheduleDocumentRenderKick();
    return noStoreJson(result);
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "finalize_collection");
  }
}
