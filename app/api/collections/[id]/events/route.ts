import { z } from "zod";
import { getCollectionEvents, toLifecycleApiError } from "@/_pages/collection-lifecycle/index.server";
import { apiErrorResponse, noStoreJson, validationErrorResponse } from "@/_pages/collection-lifecycle/api/http-response";
import { collectionCursorSchema } from "@/_pages/collection-lifecycle/model/pagination";
import { getRequestId } from "@/shared/lib/server-logger";

export const dynamic = "force-dynamic";

const eventQuerySchema = z.object({ cursor: collectionCursorSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

export async function GET(request: Request, context: RouteContext<"/api/collections/[id]/events">) {
  const { id } = await context.params;
  const parsed = eventQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!z.uuid().safeParse(id).success || !parsed.success) return validationErrorResponse();
  try {
    return noStoreJson(await getCollectionEvents(id, parsed.data.cursor ?? null, parsed.data.limit));
  } catch (error: unknown) {
    return apiErrorResponse(toLifecycleApiError(error), getRequestId(request), "list_collection_events");
  }
}
