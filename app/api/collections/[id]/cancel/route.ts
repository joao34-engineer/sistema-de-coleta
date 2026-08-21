import { z } from "zod";
import { cancelCollection, reasonCommandSchema, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, idempotencyKeyRequiredResponse, idempotencyKeyState, jsonBody, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/cancel">) {
  const { id } = await context.params;
  const idempotencyKeyStateResult = idempotencyKeyState(request);
  const parsed = reasonCommandSchema.safeParse(await jsonBody(request));
  if (!z.uuid().safeParse(id).success || !parsed.success || idempotencyKeyStateResult.kind === "invalid") return validationErrorResponse();
  if (idempotencyKeyStateResult.kind === "missing") return idempotencyKeyRequiredResponse();
  try {
    return noStoreJson(await cancelCollection(id, parsed.data.expectedVersion, parsed.data.reason, idempotencyKeyStateResult.value));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "cancel_collection");
  }
}
