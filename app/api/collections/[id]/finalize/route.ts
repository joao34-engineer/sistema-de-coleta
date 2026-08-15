import { z } from "zod";
import { criticalCommandSchema, finalizeCollection, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, idempotencyKeyFrom, jsonBody, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/finalize">) {
  const { id } = await context.params;
  const idempotencyKey = idempotencyKeyFrom(request);
  const parsed = criticalCommandSchema.safeParse(await jsonBody(request));
  if (!z.uuid().safeParse(id).success || !idempotencyKey || !parsed.success) return validationErrorResponse();
  try {
    return noStoreJson(await finalizeCollection(id, parsed.data.expectedVersion, idempotencyKey));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error));
  }
}
