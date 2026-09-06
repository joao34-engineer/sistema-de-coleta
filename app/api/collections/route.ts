import { listCollections, collectionQuerySchema, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams);
  const statuses = url.searchParams.getAll("statuses");
  const parsed = collectionQuerySchema.safeParse(
    statuses.length > 1 ? { ...raw, statuses: statuses.join(",") } : raw,
  );
  if (!parsed.success) return validationErrorResponse();
  try {
    return noStoreJson(await listCollections(parsed.data));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "list_collections");
  }
}
